-- =============================================================================
-- Migration — Origine de la préférence patient/chauffeur — CHAUFFEUR-03, §5.6
-- =============================================================================
-- PATIENT-02 a posé la direction « le patient préfère / évite ce chauffeur »
-- (table patient_driver_preference, unicité (patient_id, driver_id)). Le §5.6
-- introduit la direction MIROIR « le chauffeur préfère / évite ce patient ».
--
-- Les deux directions portent sur le même couple (patient, chauffeur) mais sont
-- sémantiquement DISTINCTES (« le patient évite ce chauffeur » ≠ « le chauffeur
-- évite ce patient »). On les distingue par une colonne d'origine plutôt qu'une
-- table miroir : on réutilise ainsi la RLS, le lookup et l'UI sans dupliquer.
--
-- Modèle :
--   - enum driver_preference_origin (patient, chauffeur)
--   - colonne origin (défaut 'patient' → migre les lignes existantes)
--   - unicité (patient_id, driver_id, origin) : un couple peut porter une
--     préférence dans CHAQUE direction, mais pas deux fois la même direction.
--     L'exclusion mutuelle prefere/evite reste PAR direction (gérée côté action).
--
-- RLS inchangée : les policies reposent sur organization_id + rôle régulateur/
-- dirigeant, jamais sur l'origine — la nouvelle direction est couverte d'office.
-- L'index (organization_id, driver_id) existant sert le lookup « depuis un
-- chauffeur, ses patients préférés/évités ».
-- =============================================================================

-- -- Section 1 — Enum d'origine --------------------------------------------------
create type public.driver_preference_origin as enum (
  'patient', -- préférence exprimée côté patient (PATIENT-02) : patient → chauffeur
  'chauffeur' -- préférence exprimée côté chauffeur (CHAUFFEUR-03) : chauffeur → patient
);

-- -- Section 2 — Colonne origin (défaut 'patient' migre l'existant) --------------
alter table public.patient_driver_preference
  add column origin public.driver_preference_origin not null default 'patient';

comment on column public.patient_driver_preference.origin is
  'Direction de la préférence (CHAUFFEUR-03) : patient→chauffeur ou chauffeur→'
  'patient. Les lignes antérieures à CHAUFFEUR-03 sont en origin=patient.';

-- -- Section 3 — Unicité ajustée -----------------------------------------------
-- (patient_id, driver_id) → (patient_id, driver_id, origin) : une direction au
-- plus par couple. L'exclusion prefere/evite reste assurée par direction côté
-- action (retrait puis ajout).
alter table public.patient_driver_preference
  drop constraint patient_driver_preference_unique;
alter table public.patient_driver_preference
  add constraint patient_driver_preference_unique unique (patient_id, driver_id, origin);
