-- Mini-PR fix — Ajout 'override' à rides.tarif_source
--
-- Bug latent (dette Phase 04.7 révélée Phase 05.5 Wave 4) :
-- override.ts écrit tarif_source='override' mais la contrainte
-- rides_tarif_source_check (migration 20260512000003) n'autorisait que
-- NULL | 'manuel' | 'cgss_auto' → tout override régulateur échouait
-- silencieusement (UPDATE rejeté par Postgres).
--
-- 'override' = tarif forcé délibérément par le régulateur (distinct de
-- 'manuel' saisie chauffeur et 'cgss_auto' calcul moteur). Distinguer
-- 'override' permet au recalcul rétroactif DEC-060 de le préserver
-- (recomputeTarifsAction ne cible que 'cgss_auto').
--
-- Aucune migration de données : 0 ligne 'override' n'existe (toutes
-- rejetées par l'ancienne contrainte).

alter table public.rides
  drop constraint rides_tarif_source_check;

alter table public.rides
  add constraint rides_tarif_source_check
  check (
    tarif_source is null
    or tarif_source in ('manuel', 'cgss_auto', 'override')
  );
