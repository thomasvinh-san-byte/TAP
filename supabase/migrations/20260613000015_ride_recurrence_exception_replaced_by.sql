-- =============================================================================
-- Migration — Surcharge d'occurrence (override) — RECURRENCE-02, §5.9
-- =============================================================================
-- Pattern standard iCalendar (RFC 5545) : un override = EXDATE (exclusion de la
-- date d'origine) + instance modifiée rattachée à la série. Aucune table
-- nouvelle : l'instance modifiée EST la course matérialisée éditée (elle garde
-- son ride_recurrence_id). On réutilise `ride_recurrence_exceptions` pour
-- l'exclusion de la date d'origine (déjà le mécanisme d'annulation).
--
-- Seule extension : une colonne minimale `replaced_by_ride_id` (nullable) pour
-- DISTINGUER un déplacement d'occurrence (override) d'une simple annulation, et
-- savoir par quelle course la date a été remplacée. ON DELETE SET NULL : si la
-- course de remplacement disparaît, l'exclusion (EXDATE) demeure — la date
-- d'origine reste exclue, jamais régénérée.
-- =============================================================================

alter table public.ride_recurrence_exceptions
  add column replaced_by_ride_id uuid references public.rides(id) on delete set null;

comment on column public.ride_recurrence_exceptions.replaced_by_ride_id is
  'Override (RECURRENCE-02) : course de remplacement quand la date d''origine a '
  'été DÉPLACÉE (≠ annulation simple où la colonne reste NULL).';
