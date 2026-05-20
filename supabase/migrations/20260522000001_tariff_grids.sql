-- Phase 05.5 Wave 1 — Grille tarifaire CGSS versionnée (DEC-057)
-- Convention-cadre nationale CNAM/taxi applicable 2026.
-- Tarif km 974 + supplément DROM en BDD (volatilité conflit local 974) —
-- jamais hardcodés dans le code (DEC-057).

create table public.tariff_grids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date_effet date not null,
  forfait_eur numeric(6,2) not null,
  km_inclus integer not null,
  prix_km_eur numeric(6,2) not null,
  supplement_drom_eur numeric(6,2) not null,
  supplement_tpmr_eur numeric(6,2) not null,
  majoration_pct integer not null,
  facteur_correction_routier numeric(4,2) not null,
  arrondi_eur numeric(4,2) not null default 0.05,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, date_effet)
);

-- Index « grille active » : MAX(date_effet) <= today par organisation.
create index tariff_grids_org_date_effet_idx
  on public.tariff_grids (organization_id, date_effet desc);

alter table public.tariff_grids enable row level security;

-- SELECT : régulateur + dirigeant de l'organisation.
create policy tariff_grids_select_org on public.tariff_grids
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

-- INSERT : dirigeant uniquement (édition = nouvelle version DEC-057).
create policy tariff_grids_insert_dirigeant on public.tariff_grids
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

-- Pas d'UPDATE / DELETE : versionnement strict (chaque changement = INSERT).

-- Seed grille 974 active — convention CNAM en vigueur 1er nov 2025.
-- created_by null = seed système (le dirigeant prend le relai au 1er edit).
-- Une grille par organisation existante (V1.5 mono-régie = 1 grille).
insert into public.tariff_grids (
  organization_id, date_effet, forfait_eur, km_inclus, prix_km_eur,
  supplement_drom_eur, supplement_tpmr_eur, majoration_pct,
  facteur_correction_routier, arrondi_eur
)
select id, '2025-11-01', 13.00, 4, 1.22, 3.00, 30.00, 50, 1.40, 0.05
from public.organizations;
