-- =============================================================================
-- Migration — Validation du planning J+1 + gel du « prévu » (Module 5.12 lot D)
-- =============================================================================
-- CdG §5.12 : la régulation VALIDE le planning du lendemain. Cette validation
--   1. notifie les chauffeurs (push) et confirme aux patients (SMS) — best-effort ;
--   2. FIGE l'état « prévu » du jour (instantané) pour permettre, le lendemain,
--      la comparaison prévu vs réalisé (lot E, historique).
--
-- Deux tables append-only (des FAITS figés, jamais modifiés) :
--   - planning_validations : une validation par (organisation, jour). L'unicité
--     (organization_id, planning_date) rend la re-validation IDEMPOTENTE : la
--     2ᵉ tentative ne réécrit rien (l'action serveur détecte le doublon et ne
--     renotifie pas, ne re-fige pas).
--   - planning_validation_rides : instantané du « prévu » de chaque course au
--     moment de la validation (chauffeur, véhicule, patient, heure, statut).
--
-- Pas d'UPDATE ni de DELETE exposés : un instantané qui changerait ne serait
-- plus un instantané. RLS par organisation, INSERT réservé régulateur/dirigeant.
-- Pattern RLS calqué driver_incidents (20260612000003) + ride_groups.
-- =============================================================================

-- -- Section 1 — En-tête de validation -----------------------------------------
create table public.planning_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Jour validé (clé métier, fuseau Réunion côté application).
  planning_date date not null,
  validated_at timestamptz not null default now(),
  validated_by uuid not null references auth.users(id),
  -- Compteurs de notification (traçabilité best-effort, non bloquants).
  notified_drivers integer not null default 0 check (notified_drivers >= 0),
  notified_patients integer not null default 0 check (notified_patients >= 0),
  created_at timestamptz not null default now()
);

comment on table public.planning_validations is
  'Validation du planning d''un jour (Module 5.12 lot D). Un enregistrement par '
  '(organisation, jour) — unicité = idempotence de la re-validation. Fige le '
  'prévu via planning_validation_rides.';

-- Idempotence : une seule validation par organisation et par jour.
create unique index planning_validations_org_date_uk
  on public.planning_validations (organization_id, planning_date);

alter table public.planning_validations enable row level security;
alter table public.planning_validations force row level security;

create policy planning_validations_select_org on public.planning_validations
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy planning_validations_insert_regulateur on public.planning_validations
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );
-- Pas d'UPDATE/DELETE : la validation est un fait figé.

revoke all on public.planning_validations from anon;
grant select, insert on public.planning_validations to authenticated;

-- -- Section 2 — Instantané des courses « prévues » ----------------------------
create table public.planning_validation_rides (
  id uuid primary key default gen_random_uuid(),
  validation_id uuid not null
    references public.planning_validations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ride_id uuid not null references public.rides(id) on delete cascade,
  -- Instantané du « prévu » au moment de la validation (nullable : course non
  -- affectée, patient absent d'une course temps réel…).
  driver_id uuid null references public.drivers(id) on delete set null,
  vehicle_id uuid null references public.vehicles(id) on delete set null,
  patient_id uuid null references public.patients(id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null,
  created_at timestamptz not null default now()
);

comment on table public.planning_validation_rides is
  'Instantané du « prévu » d''une course au moment de la validation du planning '
  '(Module 5.12 lots D/E). Base de la comparaison prévu vs réalisé.';

create index planning_validation_rides_validation_idx
  on public.planning_validation_rides (validation_id);
create index planning_validation_rides_organization_id_idx
  on public.planning_validation_rides (organization_id);
-- Une course figée une seule fois par validation.
create unique index planning_validation_rides_validation_ride_uk
  on public.planning_validation_rides (validation_id, ride_id);

alter table public.planning_validation_rides enable row level security;
alter table public.planning_validation_rides force row level security;

create policy planning_validation_rides_select_org on public.planning_validation_rides
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy planning_validation_rides_insert_regulateur on public.planning_validation_rides
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );
-- Pas d'UPDATE/DELETE : instantané figé.

revoke all on public.planning_validation_rides from anon;
grant select, insert on public.planning_validation_rides to authenticated;
