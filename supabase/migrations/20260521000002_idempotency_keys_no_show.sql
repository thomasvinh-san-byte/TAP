-- Phase 05 Wave 6 — Ajout 'no_show_ride' à idempotency_keys.mutation_type
--
-- Constraint actuelle (Phase 04.9, migration 20260518000002) :
--   check (mutation_type in ('start_ride', 'end_ride'))
--
-- Phase 05 Wave 6 étend avec 'no_show_ride' pour le Route Handler PWA
-- /api/driver/rides/[rideId]/no-show cohérent DEC-045 pattern.

alter table public.idempotency_keys
  drop constraint idempotency_keys_mutation_type_check;

alter table public.idempotency_keys
  add constraint idempotency_keys_mutation_type_check
  check (mutation_type in ('start_ride', 'end_ride', 'no_show_ride'));
