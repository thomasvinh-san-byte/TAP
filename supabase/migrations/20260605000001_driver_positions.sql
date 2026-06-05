-- Phase 10.0 — Prototype géoloc (pré-HDS, DEC-096).
--
-- Table de captures évenementielles de positions chauffeur. Tant que
-- HDS n'est pas en place (DEC-075), seules les positions `source='demo'`
-- doivent être présentes en production : le flag applicatif
-- `GEOLOC_ENABLED` empêche l'écriture de `source='event'`/'foreground'
-- en environnement non-HDS.
--
-- Schéma volontairement simple :
--   - `lat`/`lng` numeric(10,7) — compatible BAN/géoplateforme déjà
--     utilisée (06.19).
--   - `accuracy` numeric (mètres) — issue de l'API navigateur.
--   - `captured_at` timestamptz — horodatage de la capture côté client.
--   - `source` text check — 'event' (pointage), 'foreground' (watchPosition
--     opportuniste), 'demo' (seed démo statique, jamais animé).
--
-- Rétention 90j (DEC-075 + CDC §5.17) : fonction `purge_driver_positions`
-- programmée via pg_cron mensuel. En démo le purge ne touche rien (les
-- positions démo ont des dates rétro suffisantes pour rester visibles).

create table if not exists public.driver_positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  driver_id uuid not null references public.profiles(id) on delete cascade,
  ride_id uuid null references public.rides(id) on delete set null,
  lat numeric(10, 7) not null check (lat between -90 and 90),
  lng numeric(10, 7) not null check (lng between -180 and 180),
  accuracy numeric null check (accuracy is null or accuracy >= 0),
  captured_at timestamptz not null default now(),
  source text not null check (source in ('event', 'foreground', 'demo')),
  created_at timestamptz not null default now()
);

comment on table public.driver_positions is
  'Phase 10.0 prototype geoloc. Captures evenementielles position chauffeur.';
comment on column public.driver_positions.source is
  'event=pointage; foreground=watchPosition; demo=seed fictif statique.';

-- Index : lecture cockpit = dernière position par chauffeur, récent en tête.
create index if not exists driver_positions_driver_recent_idx
  on public.driver_positions (driver_id, captured_at desc);
create index if not exists driver_positions_org_idx
  on public.driver_positions (organization_id);

-- RLS
alter table public.driver_positions enable row level security;

-- Régulateurs / dirigeants lisent les positions de leur organisation.
create policy driver_positions_select_regulateur_dirigeant
  on public.driver_positions
  for select
  using (
    organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('regulateur', 'dirigeant')
    )
  );

-- Chauffeurs lisent uniquement leurs propres positions.
create policy driver_positions_select_chauffeur
  on public.driver_positions
  for select
  using (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Chauffeurs écrivent uniquement leur position.
create policy driver_positions_insert_chauffeur
  on public.driver_positions
  for insert
  with check (
    driver_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'chauffeur'
    )
  );

-- Rétention 90j — fonction de purge câblée. En démo elle peut être
-- programmée sans effet réel (positions démo sont 'demo' source, non
-- purgées avant 90j).
create or replace function public.purge_driver_positions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.driver_positions
  where captured_at < now() - interval '90 days';
$$;

comment on function public.purge_driver_positions is
  'Phase 10.0 : purge positions > 90 jours. Pre-HDS : appelable manuellement, sera schedulee pg_cron mensuel a la mise en service reelle (DEC-075).';

-- Pré-HDS : on ne schedule PAS encore le cron. La fonction est prête,
-- on l'activera dans la migration de bascule HDS (Phase 09) avec :
--   select cron.schedule('purge_driver_positions_monthly',
--                        '0 3 1 * *',
--                        'select public.purge_driver_positions()');
