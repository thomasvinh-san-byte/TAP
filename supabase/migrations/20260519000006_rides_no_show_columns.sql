-- Phase 05 Wave 1 — Colonnes patient absent sur rides
-- Workflow patient absent (Wave 6) — horodatage + motif libre.

alter table public.rides
  add column no_show_at timestamptz null,
  add column no_show_motif text null;

create index rides_no_show_at_idx
  on public.rides (no_show_at)
  where no_show_at is not null;
