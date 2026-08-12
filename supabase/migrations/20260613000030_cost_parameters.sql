-- =============================================================================
-- Migration — Paramètres de coût par organisation (§5.20 lot E)
-- =============================================================================
-- KPIs économiques (coût/km, marge brute, rentabilité) : le CdC §5.20 exige des
-- coûts PARAMÉTRABLES (carburant + entretien + amortissement). Sans paramètres
-- saisis, aucune marge ne peut être calculée → l'UI affiche « non configuré »
-- (jamais un zéro trompeur). Une seule configuration par organisation
-- (unique organization_id), éditée par le dirigeant.
--
-- Trois composantes en €/km (le coût/km total = leur somme). Un €/km unique et
-- décomposé suffit au MVP ; une granularité par véhicule/mode viendra si besoin.
--
-- RLS org-scoped stricte : lecture par tout membre de l'org, écriture réservée
-- au dirigeant (pattern paramètres tarifaires). Modifs journalisées côté action.
-- =============================================================================

create table public.cost_parameters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  cout_carburant_eur_km numeric(6, 3) not null default 0 check (cout_carburant_eur_km >= 0 and cout_carburant_eur_km <= 99),
  cout_entretien_eur_km numeric(6, 3) not null default 0 check (cout_entretien_eur_km >= 0 and cout_entretien_eur_km <= 99),
  cout_amortissement_eur_km numeric(6, 3) not null default 0 check (cout_amortissement_eur_km >= 0 and cout_amortissement_eur_km <= 99),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

comment on table public.cost_parameters is
  'Paramètres de coût par organisation (CdC §5.20 lot E) — coûts €/km carburant + entretien + amortissement, éditables par le dirigeant, pour les KPIs de marge. Une ligne par organisation.';

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.cost_parameters enable row level security;
alter table public.cost_parameters force row level security;

-- SELECT : tout membre de l'organisation (config non sensible).
create policy cost_parameters_select on public.cost_parameters
  for select to authenticated
  using (organization_id = public.current_organization_id());

-- INSERT : dirigeant, même org.
create policy cost_parameters_insert on public.cost_parameters
  for insert to authenticated
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- UPDATE : dirigeant, même org.
create policy cost_parameters_update on public.cost_parameters
  for update to authenticated
  using (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  )
  with check (
    organization_id = public.current_organization_id()
    and public.has_role('dirigeant'::public.user_role)
  );

-- =============================================================================
-- Grants (convention repo : revoke anon + grant ciblé authenticated)
-- =============================================================================
revoke all on public.cost_parameters from anon;
grant select, insert, update on public.cost_parameters to authenticated;
