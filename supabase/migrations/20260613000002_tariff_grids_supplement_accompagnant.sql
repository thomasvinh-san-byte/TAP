-- =============================================================================
-- Migration — Supplément accompagnant dans la grille tarifaire (DEC-172, T2)
-- =============================================================================
-- Le coût d'un accompagnant payant est PARAMÉTRABLE dans la grille CGSS
-- (DEC-057 — aucune valeur tarifaire hardcodée). Le moteur `computeCgssFromDistance`
-- applique ce supplément quand `accompagnant_payant = true`, comme le supplément
-- TPMR.
--
-- NB règle métier à valider (tracé registre §11) : CPAM rembourse l'accompagnant
-- « au même taux que le patient ». La V1 implémente un SUPPLÉMENT paramétrable
-- (terme additif soumis à la majoration nuit/week-end comme le reste), sans
-- présumer d'un doublement du forfait. La grille B2B
-- (`ordering_party_tariff_grids`) n'est PAS modifiée ici : le moteur retombe sur
-- 0 pour ces grilles (dégradation gracieuse, extension B2B tracée).
--
-- `not null default 0` → grilles existantes inchangées (supplément neutre).
-- =============================================================================

alter table public.tariff_grids
  add column supplement_accompagnant_eur numeric(6, 2) not null default 0;

comment on column public.tariff_grids.supplement_accompagnant_eur is
  'Supplément accompagnant payant (DEC-172). Appliqué si rides.accompagnant_payant.';
