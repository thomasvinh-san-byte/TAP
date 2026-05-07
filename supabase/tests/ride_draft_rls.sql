-- =============================================================================
-- pgTAP — RLS ride_draft (Phase 2, Plan 02-01, Wave 0 RED scaffold)
-- =============================================================================
-- Couvrira en Wave 1 (Pitfall 4 RESEARCH — author_id scoping strict) :
--   - 2 régulateurs DANS LA MÊME ORG ne se voient pas leurs brouillons
--     (RLS = author_id = auth.uid() AND organization_id = current_org)
--   - INSERT impossible avec author_id ≠ auth.uid()
--   - DELETE possible uniquement par l'auteur
--   - Cross-org refusé (paranoïa multi-tenant)
-- Wave 0 : plan(0) — la table public.ride_draft n'existe pas encore.
-- =============================================================================
begin;

select plan(0);

-- TODO Wave 1 : fixture étendue avec un 2e régulateur Alpha (eeeeeeee-...)
-- pour valider l'isolation author_id stricte ; pas de trigger d'audit
-- attendu sur ride_draft (donnée transitoire).

select * from finish();
rollback;
