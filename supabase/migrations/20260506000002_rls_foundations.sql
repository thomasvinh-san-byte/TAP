-- =============================================================================
-- Migration 002 — Row Level Security sur les tables fondations
-- =============================================================================
-- Active RLS sur organizations, profiles, audit_logs et pose les policies.
-- Règle d'or : un utilisateur ne voit JAMAIS rien hors de son organization_id.
-- Élévation de privilèges interdite (un utilisateur ne peut pas se changer
-- de rôle ni d'organization).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- organizations — RLS
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organizations force row level security;

-- SELECT : on ne voit que sa propre organization
create policy organizations_select_own
  on public.organizations
  for select
  to authenticated
  using (id = public.current_organization_id());

-- UPDATE : seul le dirigeant peut modifier sa société
create policy organizations_update_dirigeant
  on public.organizations
  for update
  to authenticated
  using (
    id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (
    id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- INSERT et DELETE : interdits via API publique. Création par service_role
-- (onboarding administratif), suppression interdite (archivage logique uniquement).

-- -----------------------------------------------------------------------------
-- profiles — RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- SELECT : on voit les profils de sa propre organization
create policy profiles_select_same_org
  on public.profiles
  for select
  to authenticated
  using (organization_id = public.current_organization_id());

-- UPDATE par soi-même : limité à prenom/nom/telephone (l'élévation de
-- privilège est bloquée par un trigger BEFORE UPDATE plus bas).
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- UPDATE par dirigeant sur les membres de son organization
create policy profiles_update_dirigeant
  on public.profiles
  for update
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- INSERT : interdit via API publique (provisioning par service_role).
-- DELETE : interdit (désactivation via actif = false + date_archivage).

-- -----------------------------------------------------------------------------
-- Trigger anti-élévation de privilège sur profiles
-- -----------------------------------------------------------------------------
create or replace function public.profiles_prevent_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  acting_role public.user_role;
begin
  acting_role := public.current_user_role();

  -- Le dirigeant peut tout modifier sur les membres de son organization.
  if acting_role = 'dirigeant'::public.user_role
     and old.organization_id = public.current_organization_id() then
    return new;
  end if;

  -- Tout autre rôle : interdit de changer organization_id, role ou actif.
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Modification interdite : organization_id'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    raise exception 'Modification interdite : role'
      using errcode = '42501';
  end if;

  if new.actif is distinct from old.actif then
    raise exception 'Modification interdite : actif'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

comment on function public.profiles_prevent_self_escalation() is
  'Empêche un non-dirigeant de modifier organization_id, role ou actif sur son profil.';

create trigger profiles_prevent_self_escalation
  before update on public.profiles
  for each row
  execute function public.profiles_prevent_self_escalation();

-- -----------------------------------------------------------------------------
-- audit_logs — RLS (append-only pour les utilisateurs)
-- -----------------------------------------------------------------------------
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- SELECT : dirigeant uniquement, sur son organization
create policy audit_logs_select_dirigeant
  on public.audit_logs
  for select
  to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- INSERT : tout utilisateur authentifié peut journaliser une action sur
-- sa propre organization, en se déclarant lui-même comme actor.
create policy audit_logs_insert_self
  on public.audit_logs
  for insert
  to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (actor_id is null or actor_id = auth.uid())
  );

-- UPDATE et DELETE : interdits côté client (append-only).

-- -----------------------------------------------------------------------------
-- Sécurité supplémentaire : révoquer les droits par défaut
-- -----------------------------------------------------------------------------
revoke all on public.organizations from anon;
revoke all on public.profiles from anon;
revoke all on public.audit_logs from anon;

-- authenticated : seulement ce que les policies autorisent
grant select, update on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert on public.audit_logs to authenticated;
