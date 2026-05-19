-- Phase 05 Wave 3 — Lien rides ↔ ride_recurrences pour cascade DEC-048
-- Trou identifié dans PLAN-3 (PR #123) post-merge Wave 1 (PR #124) :
-- la colonne ride_recurrence_id manquait pour permettre :
--   1. Tracer quelle récurrence a généré chaque ride
--   2. Cascade DEC-048 : delete rides futures non-démarrées + regen
--   3. Restitution UI fiche patient (rides liées à chaque récurrence)
--
-- Réf : PLAN-3-modal-recurrence-ui.md lignes 109, 158, DEC-048 LOCKED.

alter table public.rides
  add column ride_recurrence_id uuid null
    references public.ride_recurrences(id) on delete set null;

-- Index partiel : optimise SELECT rides WHERE ride_recurrence_id = X
-- (cascade DEC-048) + listing UI fiche patient.
create index rides_ride_recurrence_id_idx
  on public.rides (ride_recurrence_id)
  where ride_recurrence_id is not null;

-- Les policies RLS existantes de rides (organization_id-based) couvrent
-- déjà les nouvelles requêtes — la colonne ride_recurrence_id ne change
-- pas les règles d'accès.
