-- =============================================================================
-- Migration — relance d'encaissement direct (CAISSE-01, §5.19)
-- =============================================================================
-- La vue « à encaisser » liste les créances directes en attente
-- (`payment_status = 'a_encaisser'`). Pour en faire un outil de recouvrement, on
-- trace la RELANCE du patient : `payment_reminded_at` = horodatage de la
-- dernière relance (NULL = jamais relancé). Colonne DÉDIÉE — aucun champ de
-- paiement existant n'est détourné.
--
-- Additive et rétrocompatible : colonne nullable, aucune valeur par défaut, sans
-- contrainte. Les politiques RLS UPDATE existantes de `public.rides`
-- (régulateur / dirigeant de l'organisation) couvrent déjà ce champ — aucune
-- politique nouvelle n'est requise.
-- =============================================================================

alter table public.rides
  add column if not exists payment_reminded_at timestamptz;

comment on column public.rides.payment_reminded_at is
  'Horodatage de la derniere relance d''encaissement direct (CAISSE-01). NULL = jamais relance.';
