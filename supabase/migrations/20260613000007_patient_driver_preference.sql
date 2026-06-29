-- =============================================================================
-- Migration — Préférences de chauffeur du patient (patient_driver_preference)
-- =============================================================================
-- CdG §5.2 « Préférences » : chauffeur préféré (prioritaire) et chauffeur à
-- éviter (sans motif, confidentialité régulateur). PATIENT-02.
--
-- DÉCISION D'ARCHITECTURE (actée) : ces préférences ne sont PAS injectées dans
-- le solveur (qui raisonne en véhicules, pas en chauffeurs). Elles sont
-- exploitées AU MODAL D'ASSIGNATION, là où le régulateur choisit le chauffeur :
--   - préféré = mise en avant (aide à la décision) ;
--   - évité   = avertissement FRANCHISSABLE (jamais un blocage dur).
--
-- CONFIDENTIALITÉ (RGPD) : donnée potentiellement sensible (une exclusion peut
-- révéler indirectement une situation du patient). Isolée par organisation
-- (RLS), réservée régulateur/dirigeant, JAMAIS exposée au chauffeur ni au
-- patient. L'évité est stocké SANS MOTIF (minimisation) — pas de champ raison.
--
-- Modèle : table patient_incidents (migration 20260613000006) pour les
-- conventions RLS / nommage / audit.
-- =============================================================================

-- -- Section 1 — Enum du type de préférence --------------------------------------
create type public.patient_driver_preference_kind as enum (
  'prefere', -- chauffeur préféré du patient (mise en avant à l'assignation)
  'evite' -- chauffeur à éviter (avertissement franchissable, sans motif)
);

-- -- Section 2 — Table patient_driver_preference --------------------------------
create table public.patient_driver_preference (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  kind public.patient_driver_preference_kind not null,
  -- PAS de champ motif/raison : minimisation RGPD (l'évité est sans motif).
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  -- Unicité sur (patient, chauffeur) — SANS le kind : un chauffeur n'apparaît
  -- qu'une fois par patient. Cela couvre d'un seul tenant les DEUX exigences :
  --   - pas de doublon (même chauffeur deux fois en préféré) ;
  --   - exclusion mutuelle (un chauffeur ne peut être préféré ET évité).
  -- Le changement de préférence se fait par retrait puis ajout (côté action).
  constraint patient_driver_preference_unique unique (patient_id, driver_id)
);

comment on table public.patient_driver_preference is
  'Préférences chauffeur du patient (CdG §5.2, PATIENT-02) — préféré / évité. '
  'Hors solveur : exploitées au modal d''assignation. Évité sans motif '
  '(minimisation RGPD). Invisibles hors outil régulateur.';

-- Lecture par patient (fiche) et lecture inverse par chauffeur (assignation).
create index patient_driver_preference_org_patient_idx
  on public.patient_driver_preference (organization_id, patient_id);
create index patient_driver_preference_org_driver_idx
  on public.patient_driver_preference (organization_id, driver_id);

-- -- Section 3 — RLS forcée + policies (calquées sur patient_incidents) ----------
alter table public.patient_driver_preference enable row level security;
alter table public.patient_driver_preference force row level security;

create policy patient_driver_preference_select_same_org on public.patient_driver_preference
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy patient_driver_preference_insert_regulateur on public.patient_driver_preference
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy patient_driver_preference_delete_regulateur on public.patient_driver_preference
  for delete to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

revoke all on public.patient_driver_preference from anon;
grant select, insert, delete on public.patient_driver_preference to authenticated;

-- -- Section 4 — Trigger d'audit (calqué sur patient_incidents) ------------------
create or replace function public.patient_driver_preference_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'patient_driver_preference.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'patient_driver_preference', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger patient_driver_preference_audit_trigger
  after insert or update or delete on public.patient_driver_preference
  for each row execute function public.patient_driver_preference_audit_trigger();
