-- =============================================================================
-- Migration 004 — Courses (rides + ride_draft)
-- =============================================================================
-- Crée :
--   - 3 enums : ride_transport_mode (4), ride_urgency (3), ride_status (8)
--   - table rides : saisie express V1 (sans pricing/recurrence/driver — futurs)
--   - table ride_draft : brouillons RGPD-compliant (author_id scoping, pas localStorage)
--   - RLS forcée sur les deux tables + policies
--     (regulateur+dirigeant pour rides ; brouillons author-only pour ride_draft)
--   - 2 triggers updated_at + 1 trigger d'audit (rides UNIQUEMENT — D-10)
--   - 3 indexes sur rides (org+scheduled_at, patient_idx, partial status='validee')
--   - 1 index sur ride_draft (author_id + updated_at)
-- Refs : D-01 / D-02 / D-10 ; pattern dupliqué de 20260507000001_patients.sql
-- =============================================================================

-- -- Section 1 — Types énumérés ------------------------------------------------
create type public.ride_transport_mode as enum (
  'taxi_conventionne',  -- taxi conventionné CGSS
  'tpmr',                -- transport personne à mobilité réduite (fauteuil)
  'vsl',                 -- véhicule sanitaire léger (agrément ARS)
  'ambulance'            -- ambulance (V2 — exposé pour future-proofing)
);

create type public.ride_urgency as enum (
  'programmee',          -- créneau planifié à l'avance
  'urgente',             -- à caser dans la journée
  'immediate'            -- < 1h, alerte cockpit
);

create type public.ride_status as enum (
  'brouillon',           -- pas encore validée (uniquement via ride_draft V1)
  'validee',             -- créée, en attente d'assignation chauffeur (V1 = état terminal)
  'assignee',            -- chauffeur affecté (Phase 6)
  'en_cours',            -- chauffeur a démarré (Phase 9)
  'terminee',            -- course clôturée (Phase 9)
  'annulee_regulateur',  -- annulée avant assignation
  'annulee_patient',     -- annulée par patient (Phase 7 imprévus)
  'annulee_chauffeur'    -- annulée par chauffeur (Phase 7 imprévus)
);

-- -- Section 2 — Table rides ---------------------------------------------------
create table public.rides (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  scheduled_at timestamptz not null,
  pickup_address text not null,
  pickup_postal_code text,
  pickup_city text,
  dropoff_address text not null,
  dropoff_postal_code text,
  dropoff_city text,
  transport_mode public.ride_transport_mode not null default 'taxi_conventionne',
  urgency public.ride_urgency not null default 'programmee',
  status public.ride_status not null default 'validee',
  notes_regulateur text,
  -- Champs futurs commentés pour rappel (à activer en migrations 005/006/007) :
  -- prescription_id uuid references public.prescriptions(id),
  -- ride_recurrence_id uuid references public.ride_recurrences(id),
  -- driver_id uuid references public.drivers(id),
  -- vehicle_id uuid references public.vehicles(id),
  archive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  constraint notes_regulateur_max_500 check (
    notes_regulateur is null or char_length(notes_regulateur) <= 500
  )
);

-- -- Section 3 — Index rides ---------------------------------------------------
create index rides_org_scheduled_idx
  on public.rides (organization_id, scheduled_at desc);
create index rides_patient_idx
  on public.rides (patient_id);
create index rides_status_validee_idx
  on public.rides (organization_id, status)
  where status = 'validee';

-- -- Section 4 — RLS forcée + policies (rides) --------------------------------
alter table public.rides enable row level security;
alter table public.rides force row level security;

create policy rides_select_same_org on public.rides
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy rides_insert_regulateur_dirigeant on public.rides
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and created_by = auth.uid()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy rides_update_regulateur_dirigeant on public.rides
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de policy DELETE — archivage logique via colonne archive (D-01).

-- -- Section 5 — Trigger updated_at (rides) -----------------------------------
create trigger rides_set_updated_at
  before update on public.rides
  for each row execute function public.set_updated_at();

-- -- Section 6 — Trigger d'audit rides ----------------------------------------
-- Aucune colonne sensible chiffrée à filtrer (NIR n'est pas dans rides).
-- Audit complet via to_jsonb(old) / to_jsonb(new) — pattern Phase 1 patients.
create or replace function public.rides_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare action_name text;
begin
  action_name := 'ride.' || lower(tg_op);
  insert into public.audit_logs
    (organization_id, actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(), public.current_user_role(),
    action_name, 'ride', coalesce(new.id, old.id),
    jsonb_build_object(
      'old', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
      'new', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
    )
  );
  return coalesce(new, old);
end; $$;

create trigger rides_audit_trigger
  after insert or update or delete on public.rides
  for each row execute function public.rides_audit_trigger();

-- -- Section 7 — Table ride_draft ---------------------------------------------
-- Brouillons RGPD-compliant (D-02) : DB plutôt que localStorage car contient
-- potentiellement des données patient. RLS author-scoped strict (Pitfall 4
-- RESEARCH — DEUX prédicats author_id ET organization_id pour empêcher tout
-- contournement par un régulateur de la même org).
create table public.ride_draft (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ride_draft_author_idx
  on public.ride_draft (author_id, updated_at desc);

-- -- Section 8 — RLS forcée + policy unique (ride_draft) ----------------------
alter table public.ride_draft enable row level security;
alter table public.ride_draft force row level security;

-- Policy ALL : lecture, écriture, mise à jour, suppression UNIQUEMENT par
-- l'auteur ET dans son organization. Deux prédicats — paranoïa multi-tenant.
create policy ride_draft_owner_all on public.ride_draft
  for all to authenticated
  using (
    author_id = auth.uid()
    and organization_id = public.current_organization_id()
  )
  with check (
    author_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

-- -- Section 9 — Trigger updated_at (ride_draft) -----------------------------
create trigger ride_draft_set_updated_at
  before update on public.ride_draft
  for each row execute function public.set_updated_at();
-- PAS de trigger d'audit sur ride_draft (D-10 — donnée transitoire).

-- -- Section 10 — Revoke / Grant ---------------------------------------------
revoke all on public.rides from anon;
grant select, insert, update on public.rides to authenticated;

revoke all on public.ride_draft from anon;
grant select, insert, update, delete on public.ride_draft to authenticated;

-- -- Section 11 — Commentaires documentaires --------------------------------
comment on table public.rides is
  'Courses (saisie express V1) — D-01. Champs prescription/recurrence/driver à venir.';
comment on table public.ride_draft is
  'Brouillons de saisie course (RGPD — DB plutôt que localStorage). D-02.';
comment on function public.rides_audit_trigger() is
  'Trigger audit rides — INSERT/UPDATE/DELETE → audit_logs (action ride.*). D-10.';
