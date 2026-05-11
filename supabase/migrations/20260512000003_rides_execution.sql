-- =============================================================================
-- Migration 013 — Extension rides : assignation chauffeur + exécution + paiement
-- =============================================================================
-- ALTER de public.rides (créée Phase 2 — 20260509000001_rides.sql, FIGÉE).
-- Ajoute :
--   - driver_id / vehicle_id (FK on delete restrict — pas de drop silencieux)
--   - started_at / ended_at (timestamps exécution)
--   - tarif_amount_eur / tarif_source (saisie manuelle V1, cgss_auto Passe 2)
--   - payment_status / payment_method / payment_received_at
--   - 3 contraintes de cohérence (encaissement complet, started ⇒ driver,
--     ended ≥ started)
--   - 1 index sur (driver_id, scheduled_at desc) partiel statuts actifs
--
-- Le trigger rides_audit_trigger existant (Phase 2) journalise déjà toutes
-- les colonnes via to_jsonb(old/new) — aucune modification du trigger n'est
-- nécessaire, les nouvelles colonnes seront capturées automatiquement.
-- Refs : brief E2E v2 Passe 1 §4.3
-- =============================================================================

-- -- Section 1 — Nouvelles colonnes --------------------------------------------
alter table public.rides
  add column driver_id uuid references public.drivers(id) on delete restrict;

alter table public.rides
  add column vehicle_id uuid references public.vehicles(id) on delete restrict;

alter table public.rides
  add column started_at timestamptz;

alter table public.rides
  add column ended_at timestamptz;

alter table public.rides
  add column tarif_amount_eur numeric(10, 2)
    check (tarif_amount_eur is null or tarif_amount_eur >= 0);

alter table public.rides
  add column tarif_source text
    check (tarif_source is null or tarif_source in ('manuel', 'cgss_auto'));

alter table public.rides
  add column payment_status text not null default 'non_concerne'
    check (payment_status in ('non_concerne', 'a_encaisser', 'encaisse'));

alter table public.rides
  add column payment_method text
    check (
      payment_method is null
      or payment_method in ('cash', 'cb', 'cheque', 'cgss_differe')
    );

alter table public.rides
  add column payment_received_at timestamptz;

-- -- Section 2 — Contraintes de cohérence --------------------------------------
-- 1. Encaissement complet : status=encaisse impose method ET received_at non-null
alter table public.rides
  add constraint rides_payment_encaisse_complet check (
    payment_status <> 'encaisse'
    or (payment_method is not null and payment_received_at is not null)
  );

-- 2. Une course démarrée doit avoir un chauffeur assigné
alter table public.rides
  add constraint rides_started_requires_driver check (
    started_at is null or driver_id is not null
  );

-- 3. ended_at ≥ started_at (et started_at obligatoire si ended_at présent)
alter table public.rides
  add constraint rides_ended_after_started check (
    ended_at is null
    or (started_at is not null and ended_at >= started_at)
  );

-- -- Section 3 — Index pour la liste chauffeur ---------------------------------
-- listMyRidesToday() filtre par driver_id + scheduled_at d'aujourd'hui + statuts
-- non-archivés. Index partiel pour éviter de gonfler avec des courses très
-- anciennes archivées.
create index rides_driver_scheduled_idx
  on public.rides (driver_id, scheduled_at desc)
  where status in ('assignee', 'en_cours', 'terminee') and archive = false;

-- -- Section 4 — Commentaires documentaires ----------------------------------
comment on column public.rides.driver_id is
  'Chauffeur assigné. Posée à la transition validee→assignee. Passe 1 E2E v2.';
comment on column public.rides.tarif_source is
  'manuel = saisie chauffeur V1 ; cgss_auto = calcul packages/pricing Passe 2.';
comment on column public.rides.payment_status is
  'non_concerne (CGSS pur), a_encaisser (différé), encaisse (cash/CB/chèque OK).';
