-- =============================================================================
-- pgTAP — RLS rides (Phase 2, Plan 02-01, Wave 0 RED scaffold)
-- =============================================================================
-- Couvrira en Wave 1 (après migration 004 — rides + ride_draft + RLS) :
--   - RLS activée + forcée sur public.rides
--   - Régulateur + dirigeant peuvent INSERT/SELECT dans leur org
--   - Chauffeur ne voit RIEN sur public.rides V1
--   - Cross-org refusé (org Bravo ne voit rien d'org Alpha, even with role)
--   - Default values respectées (transport_mode='taxi_conventionne',
--     urgency='programmee', status='validee')
-- Wave 0 : plan(0) — la table public.rides n'existe pas encore.
-- =============================================================================
begin;

select plan(0);

-- TODO Wave 1 : passer à plan(15+) avec assertions complètes calquées sur
-- supabase/tests/patients.sql (fixtures alpha/bravo + 2 régulateurs Alpha
-- + 1 chauffeur Alpha + assertions has_role / RLS WITH CHECK).

select * from finish();
rollback;
