-- =============================================================================
-- Tests pgTAP — Migration géocoding rides (Phase 04.7 T3.1, DEC-044)
-- =============================================================================
-- Vérifie présence des 6 colonnes nullables + 2 index partiels.
-- =============================================================================

begin;

select plan(10);

select has_column('public', 'rides', 'pickup_lat', 'rides.pickup_lat existe');
select has_column('public', 'rides', 'pickup_lng', 'rides.pickup_lng existe');
select has_column('public', 'rides', 'pickup_citycode', 'rides.pickup_citycode existe');
select has_column('public', 'rides', 'dropoff_lat', 'rides.dropoff_lat existe');
select has_column('public', 'rides', 'dropoff_lng', 'rides.dropoff_lng existe');
select has_column('public', 'rides', 'dropoff_citycode', 'rides.dropoff_citycode existe');

select col_is_null('public', 'rides', 'pickup_lat', 'pickup_lat nullable');
select col_is_null('public', 'rides', 'dropoff_lat', 'dropoff_lat nullable');

select has_index(
  'public', 'rides', 'rides_pickup_citycode_idx',
  'Index partiel rides_pickup_citycode_idx existe'
);
select has_index(
  'public', 'rides', 'rides_dropoff_citycode_idx',
  'Index partiel rides_dropoff_citycode_idx existe'
);

select * from finish();
rollback;
