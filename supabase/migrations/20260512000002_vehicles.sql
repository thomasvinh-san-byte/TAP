-- =============================================================================
-- Migration 012 — Référentiel véhicules (vehicles)
-- =============================================================================
-- Crée :
--   - table public.vehicles (référentiel véhicule d'une organization)
--   - check type ∈ {taxi_conventionne, tpmr, vsl, ambulance} (cohérent
--     avec public.ride_transport_mode mais sans coupler les deux types)
--   - index unique partiel (organization_id, upper(immatriculation))
--     where archive=false → un véhicule actif ne peut pas être saisi 2×
--   - RLS forcée pattern drivers (SELECT same_org / INSERT+UPDATE dirigeant)
--   - trigger updated_at + trigger d'audit
-- Refs : ADR-002 (multi-tenant RLS) ; brief E2E v2 Passe 1 §4.3
-- =============================================================================

-- -- Section 1 — Table vehicles -------------------------------------------------
create table public.vehicles (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  immatriculation text not null,
  marque text,
  modele text,
  type text not null check (
    type in ('taxi_conventionne', 'tpmr', 'vsl', 'ambulance')
  ),
  places_assises int check (
    places_assises is null or places_assises between 1 and 9
  ),
  places_tpmr int check (
    places_tpmr is null or places_tpmr between 0 and 3
  ),
  actif boolean not null default true,
  archive boolean not null default false,
  archive_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

comment on table public.vehicles is
  'Référentiel véhicule — un par organization. CRUD dirigeant. Passe 1 E2E v2.';

-- -- Section 2 — Index vehicles ------------------------------------------------
-- (organization_id, actif) partiel sur archive=false : pattern drivers.
create index vehicles_organization_actif_idx
  on public.vehicles (organization_id, actif)
  where archive = false;

-- Unique partiel : upper(immatriculation) pour normaliser AB-123-CD vs
-- ab-123-cd. Limité aux véhicules non-archivés pour autoriser la réaffectation
-- d'une plaque après cession (rare mais possible).
create unique index vehicles_immatriculation_unique
  on public.vehicles (organization_id, upper(immatriculation))
  where archive = false;

-- -- Section 3 — RLS forcée + policies (vehicles) -----------------------------
alter table public.vehicles enable row level security;
alter table public.vehicles force row level security;

create policy vehicles_select_same_org on public.vehicles
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy vehicles_insert_dirigeant on public.vehicles
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

create policy vehicles_update_dirigeant on public.vehicles
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive.

-- -- Section 4 — Trigger updated_at --------------------------------------------
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- -- Section 5 — Trigger d'audit vehicles --------------------------------------
create or replace function public.vehicles_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'vehicle.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'vehicle', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

comment on function public.vehicles_audit_trigger() is
  'Trigger audit vehicles — INSERT/UPDATE/DELETE → audit_logs (action vehicle.*).';

create trigger vehicles_audit_trigger
  after insert or update or delete on public.vehicles
  for each row execute function public.vehicles_audit_trigger();

-- -- Section 6 — Revoke / Grant ------------------------------------------------
revoke all on public.vehicles from anon;
grant select, insert, update on public.vehicles to authenticated;
