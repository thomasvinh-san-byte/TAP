-- =============================================================================
-- Migration — Lien rides ↔ ordering_parties (rattachement course → B2B)
-- =============================================================================
-- Ajoute la colonne ordering_party_id (NULLABLE) à public.rides.
--
-- Une course peut être rattachée à un donneur d'ordres B2B (commande passée
-- par un hôpital/clinique/EHPAD pour un de ses patients) OU n'avoir aucun
-- donneur d'ordres (cas NOMINAL : transport prescrit individuel). La colonne
-- est donc NULLABLE et ne doit JAMAIS devenir obligatoire (DEC-148).
--
-- Suit le pattern des « colonnes futures » prévues dans 20260509000001_rides.sql
-- et la migration additive 20260520000001_rides_ride_recurrence_id.sql.
-- Refs : CdC §5.5 ; DEC-148.
-- =============================================================================

alter table public.rides
  add column ordering_party_id uuid null
    references public.ordering_parties(id) on delete set null;

comment on column public.rides.ordering_party_id is
  'Donneur d''ordres B2B ayant commandé la course (NULL = transport prescrit '
  'individuel, cas nominal). CdC §5.5 / DEC-148.';

-- Index partiel : optimise les futurs récapitulatifs périodiques par donneur
-- d'ordres (SELECT rides WHERE organization_id = X AND ordering_party_id = Y)
-- sans peser sur la majorité des courses (ordering_party_id IS NULL).
create index rides_org_ordering_party_idx
  on public.rides (organization_id, ordering_party_id)
  where ordering_party_id is not null;

-- Les policies RLS existantes de rides (organization_id-based) couvrent déjà
-- les nouvelles requêtes — la colonne ordering_party_id ne change pas les
-- règles d'accès.
