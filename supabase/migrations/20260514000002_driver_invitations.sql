-- =============================================================================
-- Migration — Invitations chauffeurs (driver_invitations)
-- =============================================================================
-- Crée :
--   - table public.driver_invitations (workflow magic-link Supabase, Phase 04)
--   - 3 index : unique partiel (email) WHERE status='pending' (anti-doublon)
--               + (organization_id, status) + (driver_id) partiel
--   - RLS forcée + 3 policies :
--       SELECT : invité (invited_by) OU destinataire (email matché auth.users)
--       INSERT : dirigeant uniquement, même organization
--       UPDATE : destinataire pendant validité OU dirigeant émetteur
--       (PAS de policy DELETE — archivage logique status='revoked')
--   - trigger updated_at (réutilise public.set_updated_at)
--   - trigger d'audit : driver_invited / _accepted / _revoked / _resent / _updated
--   - revoke anon, grant authenticated (SELECT/INSERT/UPDATE — pas de DELETE)
--
-- Refs : Phase 04 PLAN-2, DEC-025 (table séparée, PAS extension drivers),
--        ADR-002 (multi-tenant RLS), DEC-010 (audit_logs INSERT-only),
--        C01 (intégralité couverte).
-- =============================================================================

-- -- Section 1 — Table driver_invitations -------------------------------------
-- driver_id nullable : l'invitation peut être créée avant l'enregistrement du
-- chauffeur dans la table drivers (cas onboarding « invitation pré-fiche »).
-- Le rattachement driver_id se fait à l'acceptation, dans la Server Action.
create table public.driver_invitations (
  id              uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id       uuid references public.drivers(id) on delete cascade,
  invited_by      uuid not null references auth.users(id) on delete restrict,
  email           text not null check (length(trim(email)) between 3 and 254),
  role            text not null default 'chauffeur' check (role in ('chauffeur')),
  status          text not null default 'pending'
    check (status in ('pending','accepted','expired','revoked')),
  expires_at      timestamptz not null default (now() + interval '24 hours'),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.driver_invitations is
  'Invitations chauffeurs — workflow magic link Supabase. Phase 04 onboarding.';

-- -- Section 2 — Index --------------------------------------------------------
-- Index unique partiel : un seul pending actif par email
-- (empêche le dirigeant d'inviter 2× le même email tant que la 1re invitation
-- est en attente). Les invitations 'accepted' / 'expired' / 'revoked' n'entrent
-- pas dans la contrainte (un nouveau pending peut être créé après revoke).
create unique index driver_invitations_pending_email_uniq
  on public.driver_invitations (email)
  where status = 'pending';

-- Index opérationnel : liste des invitations d'une organization par status
-- (pagination + filtre status côté UI dirigeant).
create index driver_invitations_org_status_idx
  on public.driver_invitations (organization_id, status);

-- Index opérationnel : retrouve l'invitation d'un driver (badge dans
-- drivers-list.client.tsx, Phase 04 §C02).
create index driver_invitations_driver_idx
  on public.driver_invitations (driver_id)
  where driver_id is not null;

-- -- Section 3 — RLS forcée + 3 policies --------------------------------------
alter table public.driver_invitations enable row level security;
alter table public.driver_invitations force row level security;

-- SELECT : émetteur (dirigeant) OU destinataire (par email matché auth.users)
create policy driver_invitations_select_invited_or_recipient
  on public.driver_invitations
  for select to authenticated
  using (
    auth.uid() = invited_by
    or email = (select u.email from auth.users u where u.id = auth.uid())
  );

-- INSERT : dirigeant uniquement, même organization, invited_by = soi-même
create policy driver_invitations_insert_dirigeant
  on public.driver_invitations
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
    and auth.uid() = invited_by
  );

-- UPDATE — 2 cas distincts, factorisés en une seule policy permissive :
--   a) destinataire pendant validité (acceptation : pending → accepted)
--   b) dirigeant émetteur (revoke / resend → expires_at refresh / status update)
create policy driver_invitations_update_recipient_or_dirigeant
  on public.driver_invitations
  for update to authenticated
  using (
    (
      email = (select u.email from auth.users u where u.id = auth.uid())
      and status = 'pending'
      and now() < expires_at
    )
    or (
      auth.uid() = invited_by
      and public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());

-- Pas de policy DELETE — archivage logique via status='revoked'.

-- -- Section 4 — Trigger updated_at -------------------------------------------
create trigger driver_invitations_set_updated_at
  before update on public.driver_invitations
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger d'audit ----------------------------------------------
-- Pattern dérivé drivers_audit_trigger : to_jsonb(old/new) intégral.
-- Aucune colonne sensible chiffrée à filtrer (email est journalisable,
-- pas de NIR ni note médicale dans cette table).
--
-- Mapping action_name :
--   INSERT                                       → driver_invited
--   UPDATE (pending → accepted)                  → driver_invitation_accepted
--   UPDATE (pending → revoked)                   → driver_invitation_revoked
--   UPDATE (pending, expires_at bumped)          → driver_invitation_resent
--   UPDATE autre                                 → driver_invitation_updated
--
-- Note DEC-027 : l'event 'cgu_accepted_via_invitation' (RGPD) sera émis
-- applicativement par acceptInvitationAction (PLAN-3 §3.4), pas ici — c'est
-- un event sémantique séparé du UPDATE technique sur driver_invitations.
create or replace function public.driver_invitations_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  if tg_op = 'INSERT' then
    action_name := 'driver_invited';
  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status = 'pending' then
      action_name := 'driver_invitation_accepted';
    elsif new.status = 'revoked' and old.status = 'pending' then
      action_name := 'driver_invitation_revoked';
    elsif new.status = 'pending' and new.expires_at > old.expires_at then
      action_name := 'driver_invitation_resent';
    else
      action_name := 'driver_invitation_updated';
    end if;
  else
    action_name := 'driver_invitation.' || lower(tg_op);
  end if;

  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'driver_invitation', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.driver_invitations_audit_trigger() is
  'Trigger audit driver_invitations — INSERT/UPDATE → audit_logs (action driver_invited / _accepted / _revoked / _resent / _updated).';

create trigger driver_invitations_audit_trigger
  after insert or update on public.driver_invitations
  for each row execute function public.driver_invitations_audit_trigger();

-- -- Section 6 — Revoke / Grant ------------------------------------------------
revoke all on public.driver_invitations from anon;
grant select, insert, update on public.driver_invitations to authenticated;
-- Pas de DELETE.
