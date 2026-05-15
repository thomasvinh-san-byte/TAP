-- =============================================================================
-- Migration — Géocoding rides (Phase 04.7 T3.1, DEC-044)
-- =============================================================================
-- Ajout colonnes nullables pickup_lat/lng/citycode + dropoff_* sur rides
-- pour persister les coordonnées BAN/POI au moment de la saisie course.
-- Préfigure le calcul tarif réel CGSS Phase 05.5 (Haversine ou OSRM).
--
-- Toutes nullables : compat existant + courses créées sans BAN (saisie libre)
-- = pas de coords + fallback random pricing DEC-042.
--
-- Refs : DEC-044 LOCKED, DEC-032 (CD push exclusif).
-- =============================================================================

alter table public.rides
  add column pickup_lat numeric(10, 7),
  add column pickup_lng numeric(10, 7),
  add column pickup_citycode text,
  add column dropoff_lat numeric(10, 7),
  add column dropoff_lng numeric(10, 7),
  add column dropoff_citycode text;

-- Index partiels (citycode) : requêtes futures par commune INSEE
-- (Phase 05.5 stats CGSS, Phase 06 facturation par zone).
create index rides_pickup_citycode_idx
  on public.rides (pickup_citycode)
  where pickup_citycode is not null;

create index rides_dropoff_citycode_idx
  on public.rides (dropoff_citycode)
  where dropoff_citycode is not null;

-- Commentaires colonnes
comment on column public.rides.pickup_lat is
  'Latitude pickup (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.pickup_lng is
  'Longitude pickup (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.pickup_citycode is
  'Code INSEE commune pickup (5 chiffres). Source BAN. Phase 04.7 DEC-044.';
comment on column public.rides.dropoff_lat is
  'Latitude dropoff (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.dropoff_lng is
  'Longitude dropoff (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
comment on column public.rides.dropoff_citycode is
  'Code INSEE commune dropoff (5 chiffres). Source BAN. Phase 04.7 DEC-044.';
