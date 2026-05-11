-- =============================================================================
-- Migration 011 — Référentiel chauffeurs (drivers)
-- =============================================================================
-- Crée :
--   - table public.drivers (référentiel chauffeur d'une organization)
--   - RLS forcée pattern Phase 1 (SELECT same_org / INSERT+UPDATE dirigeant)
--   - 2 index : (organization_id, actif) partiel archive=false + (org, profile_id)
--   - trigger updated_at + trigger d'audit pattern Phase 1 patients
--   - revoke anon, grant authenticated (SELECT/INSERT/UPDATE — pas de DELETE)
-- Refs : ADR-002 (multi-tenant RLS) ; brief E2E v2 Passe 1 §4.3
-- =============================================================================

-- -- Section 1 — Table drivers --------------------------------------------------
-- profile_id nullable : on peut enregistrer un chauffeur avant qu'il dispose
-- d'un compte Auth (cas pattern Phase 1.5 patient_data_request). Le rattachement
-- profile_id ↔ compte chauffeur se fait au moment de l'invitation par dirigeant.
create table public.drivers (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid references auth.users(id) on delete set null,
  nom_affichage text not null check (length(trim(nom_affichage)) between 1 and 80),
  telephone text,
  numero_licence text,
  -- type_permis : valeurs attendues côté zod {taxi, ambulance, vsl, tpmr}.
  -- Pas de check DB pour ne pas bloquer l'ajout d'un nouveau type métier futur
  -- sans migration (ex : 'vtc_med'). Validation centralisée dans @tap/shared.
  type_permis text[] not null default '{}',
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.drivers is
  'Référentiel chauffeur — un par organization. CRUD dirigeant. Passe 1 E2E v2.';

-- -- Section 2 — Index drivers --------------------------------------------------
-- (organization_id, actif) partiel sur archive=false : la liste dirigeant
-- filtre toujours archive=false et trie/filtre actif.
create index drivers_organization_actif_idx
  on public.drivers (organization_id, actif)
  where archive = false;

-- (organization_id, profile_id) partiel : lookup chauffeur ↔ compte auth pour
-- le SELECT « mes courses » côté chauffeur (listMyRidesToday Phase 3 03-B).
create index drivers_profile_idx
  on public.drivers (organization_id, profile_id)
  where profile_id is not null;

-- -- Section 3 — RLS forcée + policies (drivers) -------------------------------
alter table public.drivers enable row level security;
alter table public.drivers force row level security;

create policy drivers_select_same_org on public.drivers
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy drivers_insert_dirigeant on public.drivers
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy drivers_update_dirigeant on public.drivers
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive.

-- -- Section 4 — Trigger updated_at --------------------------------------------
create trigger drivers_set_updated_at
  before update on public.drivers
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger d'audit drivers ---------------------------------------
-- Pattern Phase 1 patients_audit_trigger : to_jsonb(old/new) intégral. Aucune
-- colonne sensible chiffrée à filtrer (téléphone et numéro de licence sont
-- des données opérationnelles non-secrètes, journalisables).
create or replace function public.drivers_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'driver.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'driver', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.drivers_audit_trigger() is
  'Trigger audit drivers — INSERT/UPDATE/DELETE → audit_logs (action driver.*).';

create trigger drivers_audit_trigger
  after insert or update or delete on public.drivers
  for each row execute function public.drivers_audit_trigger();

-- -- Section 6 — Revoke / Grant ------------------------------------------------
revoke all on public.drivers from anon;
grant select, insert, update on public.drivers to authenticated;
