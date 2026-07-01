-- =============================================================================
-- Migration — index liste chauffeur : ajout des états intermédiaires (FIX-01)
-- =============================================================================
-- L'index partiel `rides_driver_scheduled_idx` (migration 20260512000003) sert
-- la liste des courses du chauffeur. Sa clause `where status in (...)` listait
-- les statuts en dur et n'a pas suivi l'ajout des deux états intermédiaires de
-- PWA-01 (`arrive_sur_place`, `patient_a_bord`, §5.16). Résultat : une course en
-- cours de réalisation — précisément ce qu'un chauffeur consulte le plus —
-- n'était plus couverte par l'index (la requête restait correcte via scan, mais
-- moins performante).
--
-- Recréation drop + create (convention du projet : les autres index partiels
-- sont créés hors transaction concurrente). Aucune requête ne référence l'index
-- par son nom en dehors de ce drop.
-- =============================================================================

drop index if exists public.rides_driver_scheduled_idx;

create index rides_driver_scheduled_idx
  on public.rides (driver_id, scheduled_at desc)
  where
    status in ('assignee', 'en_cours', 'arrive_sur_place', 'patient_a_bord', 'terminee')
    and archive = false;
