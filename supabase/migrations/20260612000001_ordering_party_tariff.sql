-- =============================================================================
-- Migration — Grille tarifaire B2B par donneur d'ordres (DEC-157, socle 1/3)
-- =============================================================================
-- CdC §5.5 l.189 : « Convention tarifaire propre (grille indépendante des
-- tarifs CGSS si non conventionné, OU complément) ». On gère LES DEUX cas :
--   - `cgss_standard` (défaut) : la course du donneur utilise la grille CGSS
--     de l'organisation (comportement INCHANGÉ).
--   - `grille_propre` : la course utilise la grille propre du donneur d'ordres.
--
-- Crée :
--   - enum public.ordering_party_tariff_mode (2 valeurs)
--   - colonne ordering_parties.tariff_mode (défaut cgss_standard)
--   - table public.ordering_party_tariff_grids (grille versionnée par donneur,
--     mêmes colonnes que tariff_grids, RLS par org calquée sur tariff_grids)
--   - extension de la contrainte rides.tarif_source pour ajouter 'b2b_auto'
--     (distinct de cgss_auto → le recompute CGSS DEC-060 ne l'écrase pas)
--
-- Refs : DEC-157 ; pattern dupliqué de 20260522000001_tariff_grids.sql +
--        20260523000001_rides_tarif_source_add_override.sql.
-- 0 valeur hardcodée côté moteur : la grille B2B s'injecte dans
-- computeCgssFromDistance qui prend déjà la grille en paramètre (DEC-057).
-- =============================================================================

-- -- Section 1 — Mode de tarification du donneur d'ordres -----------------------
create type public.ordering_party_tariff_mode as enum (
  'cgss_standard', -- utilise la grille CGSS de l'organisation (défaut)
  'grille_propre'  -- utilise sa propre grille (table dédiée ci-dessous)
);

alter table public.ordering_parties
  add column tariff_mode public.ordering_party_tariff_mode not null
    default 'cgss_standard';

comment on column public.ordering_parties.tariff_mode is
  'cgss_standard = grille CGSS de l''org (défaut) ; grille_propre = grille '
  'dédiée dans ordering_party_tariff_grids. DEC-157.';

-- -- Section 2 — Grille tarifaire propre du donneur (versionnée) ----------------
create table public.ordering_party_tariff_grids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ordering_party_id uuid not null references public.ordering_parties(id) on delete cascade,
  date_effet date not null,
  forfait_eur numeric(6, 2) not null,
  km_inclus integer not null,
  prix_km_eur numeric(6, 2) not null,
  supplement_drom_eur numeric(6, 2) not null,
  supplement_tpmr_eur numeric(6, 2) not null,
  majoration_pct integer not null,
  facteur_correction_routier numeric(4, 2) not null,
  arrondi_eur numeric(4, 2) not null default 0.05,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ordering_party_id, date_effet)
);

comment on table public.ordering_party_tariff_grids is
  'Grille tarifaire propre d''un donneur d''ordres (mode grille_propre), '
  'versionnée par date_effet — même structure que tariff_grids. DEC-157.';

-- Index « grille active » : MAX(date_effet) <= today par donneur d'ordres.
create index ordering_party_tariff_grids_party_date_idx
  on public.ordering_party_tariff_grids (ordering_party_id, date_effet desc);

alter table public.ordering_party_tariff_grids enable row level security;
alter table public.ordering_party_tariff_grids force row level security;

-- SELECT : membres de l'organisation (le calcul tarifaire lit la grille).
create policy ordering_party_tariff_grids_select_org on public.ordering_party_tariff_grids
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT : dirigeant uniquement (édition = nouvelle version, versionnement strict).
create policy ordering_party_tariff_grids_insert_dirigeant on public.ordering_party_tariff_grids
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );
-- Pas d'UPDATE / DELETE : versionnement strict (chaque changement = INSERT).

-- -- Section 3 — Revoke / Grant ------------------------------------------------
revoke all on public.ordering_party_tariff_grids from anon;
grant select, insert on public.ordering_party_tariff_grids to authenticated;

-- -- Section 4 — tarif_source 'b2b_auto' ---------------------------------------
-- Distinct de 'cgss_auto' : une course tarifée via grille B2B est marquée
-- 'b2b_auto' → le recompute CGSS (DEC-060, cible 'cgss_auto') ne l'écrase pas,
-- et le recompute B2B utilise la grille du donneur (comme 'override' est déjà
-- préservé).
alter table public.rides
  drop constraint rides_tarif_source_check;

alter table public.rides
  add constraint rides_tarif_source_check
  check (
    tarif_source is null
    or tarif_source in ('manuel', 'cgss_auto', 'override', 'b2b_auto')
  );
