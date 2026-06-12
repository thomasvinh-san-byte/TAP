-- =============================================================================
-- Migration — Incidents opérationnels chauffeur (driver_incidents, DEC-160)
-- =============================================================================
-- Replanification dynamique (CdG §5.14 l.363-374, item V1.5 §11.3 l.903). Quand
-- un chauffeur tombe en PANNE (signalée depuis la PWA chauffeur) ou devient
-- INDISPONIBLE (déclaré par la régulation), la régulation doit pouvoir réaffecter
-- ses courses restantes.
--
-- Statut opérationnel TEMPORAIRE, distinct de `drivers.actif` (booléen
-- administratif PERMANENT) : un chauffeur avec un incident NON résolu est
-- « indisponible » opérationnellement, sans toucher `actif`.
--
-- Crée :
--   - enum public.driver_incident_type (panne_vehicule | indisponible)
--   - table public.driver_incidents (RLS par org)
-- Refs : DEC-160 ; pattern RLS calqué ride_groups (20260612000002) +
--        drivers (20260512000001, drivers.profile_id ↔ auth.users).
-- =============================================================================

-- -- Section 1 — Type d'incident ----------------------------------------------
create type public.driver_incident_type as enum (
  'panne_vehicule', -- panne véhicule signalée par le chauffeur (PWA)
  'indisponible'    -- indisponibilité déclarée par la régulation
);

-- -- Section 2 — Table driver_incidents ---------------------------------------
create table public.driver_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  type public.driver_incident_type not null,
  -- Nature de la panne (texte libre court) ; lieu d'immobilisation.
  nature text null check (nature is null or char_length(nature) <= 500),
  lieu text null check (lieu is null or char_length(lieu) <= 200),
  started_at timestamptz not null default now(),
  -- resolved_at NULL = incident OUVERT (chauffeur indisponible).
  resolved_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table public.driver_incidents is
  'Incident opérationnel TEMPORAIRE chauffeur (DEC-160) : panne (PWA chauffeur) '
  'ou indisponibilité (régulation). resolved_at NULL = ouvert. Distinct de '
  'drivers.actif (administratif permanent).';

create index driver_incidents_organization_id_idx
  on public.driver_incidents (organization_id);
-- Lecture régulation = incidents OUVERTS d'une org (resolved_at IS NULL).
create index driver_incidents_open_idx
  on public.driver_incidents (organization_id, driver_id)
  where resolved_at is null;

alter table public.driver_incidents enable row level security;
alter table public.driver_incidents force row level security;

-- SELECT : toute l'org (régulation voit, chauffeur voit les siens via org).
create policy driver_incidents_select_org on public.driver_incidents
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT régulation : déclarer une indisponibilité / panne pour un chauffeur.
create policy driver_incidents_insert_regulateur on public.driver_incidents
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

-- INSERT chauffeur : signaler SA PROPRE panne (driver rattaché à son profil).
create policy driver_incidents_insert_chauffeur on public.driver_incidents
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('chauffeur'::public.user_role)
    and driver_id in (
      select d.id from public.drivers d
      where d.profile_id = auth.uid()
        and d.organization_id = public.current_organization_id()
    )
  );

-- UPDATE régulation : marquer résolu (resolved_at) ; pas de transfert d'org.
create policy driver_incidents_update_regulateur on public.driver_incidents
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de DELETE : un incident tranché reste tracé (historique).

revoke all on public.driver_incidents from anon;
grant select, insert, update on public.driver_incidents to authenticated;
