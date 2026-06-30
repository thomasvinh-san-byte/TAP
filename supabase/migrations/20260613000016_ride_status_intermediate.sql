-- =============================================================================
-- Migration — États intermédiaires de course (PWA-01, §5.16)
-- =============================================================================
-- Le bouton géant chauffeur suit la séquence réelle d'une prise en charge :
--   assignee → en_cours (« je pars »)
--           → arrive_sur_place (« arrivé sur place »)   ← NOUVEAU
--           → patient_a_bord  (« patient à bord »)       ← NOUVEAU
--           → terminee        (« terminé »)
-- (standard NEMT « en route / arrivé / à bord / terminé »).
--
-- Migration ADDITIVE : ajout de deux valeurs à l'enum public.ride_status. Aucune
-- course existante n'est touchée. ADD VALUE IF NOT EXISTS est idempotent ; les
-- nouvelles valeurs ne sont PAS utilisées dans cette migration (contrainte
-- Postgres : une valeur d'enum ajoutée ne peut être référencée dans la même
-- transaction que son ajout) — la machine à états (@tap/shared) et les actions
-- les emploieront ensuite.
-- =============================================================================

alter type public.ride_status add value if not exists 'arrive_sur_place';
alter type public.ride_status add value if not exists 'patient_a_bord';
