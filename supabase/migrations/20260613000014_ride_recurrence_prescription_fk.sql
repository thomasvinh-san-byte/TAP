-- =============================================================================
-- Migration — FK ride_recurrences.prescription_id (RENOUVELLEMENT-01, §5.3/§5.9)
-- =============================================================================
-- Prérequis du renouvellement anticipé : brancher le lien série ↔ bon de
-- transport. La colonne `prescription_id` existait (nullable, « FK reportée »)
-- mais sans contrainte. On la contraint vers `prescriptions(id)` :
--   - ON DELETE SET NULL : une série survit à la suppression de son bon (le
--     lien retombe à NULL, la série continue) ;
--   - reste NULLABLE : une série peut exister sans bon rattaché (lien optionnel).
--
-- C'est ce lien qui permet de cibler le renouvellement anticipé sur les bons
-- réellement liés à une série (évite les faux positifs sur les bons ponctuels).
-- Toutes les lignes existantes ont prescription_id NULL → aucune violation.
-- =============================================================================

alter table public.ride_recurrences
  add constraint ride_recurrences_prescription_id_fkey
  foreign key (prescription_id) references public.prescriptions(id) on delete set null;

-- Index : lookup « bons liés à une série active » (alerte de renouvellement).
create index if not exists ride_recurrences_prescription_id_idx
  on public.ride_recurrences (prescription_id)
  where prescription_id is not null;
