-- =============================================================================
-- Migration — relevé kilométrique journalier du chauffeur (PWA-04, §5.16)
-- =============================================================================
-- Le chauffeur saisit le compteur en début et en fin de journée. Un relevé par
-- chauffeur et par jour : `km_start` (départ) + `km_end` (clôture, posé plus
-- tard). Aucune table de tournée n'existe (l'historique se dérive de `rides`) —
-- ce relevé est donc une petite table dédiée.
--
-- Gardes EN BASE (pas seulement à l'écran) :
--   - valeurs positives (km_start/km_end >= 0) ;
--   - fin >= début quand les deux sont présents ;
--   - un seul relevé par chauffeur et par jour (unique org+driver+jour).
--
-- Isolation : `organization_id` + RLS. Le chauffeur ne voit/écrit QUE ses
-- propres relevés (`driver_id = auth.uid()`, driver_id = profiles.id, même
-- posture que driver_positions). Régulateur/dirigeant lisent leur organisation.
-- =============================================================================

create table if not exists public.driver_daily_mileage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  jour date not null,
  km_start integer check (km_start is null or km_start >= 0),
  km_end integer check (km_end is null or km_end >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint driver_daily_mileage_end_ge_start check (
    km_end is null or km_start is null or km_end >= km_start
  ),
  constraint driver_daily_mileage_unique_day unique (organization_id, driver_id, jour)
);

comment on table public.driver_daily_mileage is
  'Releve kilometrique journalier chauffeur (PWA-04, §5.16) : km_start/km_end par jour.';

create index if not exists driver_daily_mileage_driver_jour_idx
  on public.driver_daily_mileage (driver_id, jour desc);
create index if not exists driver_daily_mileage_org_idx
  on public.driver_daily_mileage (organization_id);

-- updated_at auto (trigger partagé s'il existe ; sinon posé applicativement).
create trigger driver_daily_mileage_set_updated_at
  before update on public.driver_daily_mileage
  for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------------
alter table public.driver_daily_mileage enable row level security;

-- Chauffeur : lecture de ses propres relevés.
create policy driver_daily_mileage_select_own
  on public.driver_daily_mileage
  for select
  using (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Chauffeur : insertion de son propre relevé (dans son organisation).
create policy driver_daily_mileage_insert_own
  on public.driver_daily_mileage
  for insert
  with check (
    driver_id = auth.uid()
    and organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Chauffeur : mise à jour de son propre relevé (clôture km_end).
create policy driver_daily_mileage_update_own
  on public.driver_daily_mileage
  for update
  using (driver_id = auth.uid())
  with check (
    driver_id = auth.uid()
    and organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

-- Régulateur / dirigeant : lecture des relevés de leur organisation.
create policy driver_daily_mileage_select_org
  on public.driver_daily_mileage
  for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('regulateur', 'dirigeant')
    )
  );
