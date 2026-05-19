-- Phase 05 Wave 6 — Lien rides clone via original_ride_id
--
-- Workflow patient absent : régulatrice click "Reprogrammer" →
-- rescheduleRideAction clone le ride avec original_ride_id pointant
-- vers le ride original (no-show). Permet :
--   1. Restitution historique côté cockpit ("ride X reprogrammé après no-show")
--   2. Reporting Phase 06+ (taux reprog vs annul après no-show)
--
-- Réf : PLAN-6 ligne 455 rescheduleRideAction, DEC-053.

alter table public.rides
  add column original_ride_id uuid null
    references public.rides(id) on delete set null;

create index rides_original_ride_id_idx
  on public.rides (original_ride_id)
  where original_ride_id is not null;
