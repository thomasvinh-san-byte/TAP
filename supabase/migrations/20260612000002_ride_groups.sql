-- =============================================================================
-- Migration — Demande groupée B2B (ride_groups, DEC-158, extension 2/3)
-- =============================================================================
-- CdC §5.5 l.191 : « un donneur d'ordres demande 5 transports d'un coup (sortie
-- d'hospitalisation collective) » + l.193 « workflow d'acceptation/refus par la
-- régulation ».
--
-- Modèle calqué sur ride_recurrences : une table parent (org, RLS, donneur)
-- → N courses enfants (rides) liées par rides.ride_group_id.
--
-- Workflow porté par le GROUPE (pas par ride_status) :
--   - création → ride_group `en_attente` + N courses enfants `brouillon`
--     (pas fermes → ne polluent ni le cockpit, ni l'optimisation, ni la caisse,
--      qui ciblent validee/terminee).
--   - acceptation → group `acceptee` + courses brouillon → validee (fermes).
--   - refus → group `refusee` + motif_refus + courses → annulee_regulateur.
--
-- Crée :
--   - enum public.ride_group_status (3 valeurs)
--   - table public.ride_groups (RLS par org calquée ride_recurrences)
--   - colonne rides.ride_group_id (NULLABLE — cas nominal = course individuelle)
--   - trigger updated_at
-- Refs : DEC-158 ; pattern 20260519000001_ride_recurrences.sql +
--        20260520000001_rides_ride_recurrence_id.sql.
-- =============================================================================

-- -- Section 1 — Statut de la demande groupée ----------------------------------
create type public.ride_group_status as enum (
  'en_attente', -- soumise, en attente de décision régulation (défaut)
  'acceptee',   -- acceptée → courses enfants fermes (validee)
  'refusee'     -- refusée → courses enfants annulées (annulee_regulateur)
);

-- -- Section 2 — Table ride_groups ---------------------------------------------
create table public.ride_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Une demande groupée est TOUJOURS rattachée à un donneur d'ordres.
  ordering_party_id uuid not null references public.ordering_parties(id) on delete cascade,
  status public.ride_group_status not null default 'en_attente',
  motif_refus text null check (motif_refus is null or char_length(motif_refus) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

comment on table public.ride_groups is
  'Demande groupée B2B (CdC §5.5, DEC-158) — parent de N courses, workflow '
  'en_attente → acceptee/refusee porté par le groupe. Toujours rattachée à un '
  'donneur d''ordres.';

create index ride_groups_organization_id_idx on public.ride_groups (organization_id);
-- File des demandes en attente (la régulation filtre status='en_attente').
create index ride_groups_org_status_idx
  on public.ride_groups (organization_id, status)
  where status = 'en_attente';

alter table public.ride_groups enable row level security;
alter table public.ride_groups force row level security;

create policy ride_groups_select_org on public.ride_groups
  for select to authenticated
  using (organization_id = public.current_organization_id());

create policy ride_groups_insert_regulateur on public.ride_groups
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  );

create policy ride_groups_update_regulateur on public.ride_groups
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and (
      public.has_role('regulateur'::public.user_role)
      or public.has_role('dirigeant'::public.user_role)
    )
  )
  with check (organization_id = public.current_organization_id());
-- Pas de DELETE : une demande tranchée (acceptée/refusée) reste tracée.

create trigger ride_groups_set_updated_at
  before update on public.ride_groups
  for each row execute function public.set_updated_at();

revoke all on public.ride_groups from anon;
grant select, insert, update on public.ride_groups to authenticated;

-- -- Section 3 — Lien rides ↔ groupe -------------------------------------------
alter table public.rides
  add column ride_group_id uuid null references public.ride_groups(id) on delete set null;

comment on column public.rides.ride_group_id is
  'Demande groupée parente (NULL = course individuelle, cas nominal). DEC-158.';

create index rides_ride_group_id_idx
  on public.rides (ride_group_id)
  where ride_group_id is not null;
