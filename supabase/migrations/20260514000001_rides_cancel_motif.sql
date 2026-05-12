-- =============================================================================
-- Migration — colonne cancel_motif sur rides (clôture-bis Passe 1)
-- =============================================================================
-- Ajoute une colonne text nullable pour stocker un motif libre (≤ 500 chars)
-- saisi au moment de l'annulation par le régulateur ou le dirigeant.
--
-- Pas d'enum motifs en V1 : on observe d'abord les motifs réels saisis
-- avant de figer une taxonomie. Migration future (Passe 4) pourra
-- introduire un type catégorisé sans casser l'historique.
--
-- L'audit log capte l'`old.status` → `new.status` et le `cancel_motif`
-- via le trigger Postgres existant `rides_audit_trigger` (jsonb to_jsonb
-- de la ligne complète).
-- =============================================================================

alter table public.rides
  add column if not exists cancel_motif text;

comment on column public.rides.cancel_motif is
  'Motif libre d''annulation (≤ 500 chars). Saisi par régulateur ou dirigeant
   au moment du basculement status → annulee_regulateur. V1 = texte libre.';
