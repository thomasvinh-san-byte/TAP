-- =============================================================================
-- Migration — Équipements de compatibilité véhicule (VEHICULE-01, §5.7)
-- =============================================================================
-- Ajoute les équipements véhicule qui conditionnent la compatibilité avec un
-- patient, EN MIROIR des besoins déjà modélisés côté patient
-- (enum public.patient_constraint_type). Correspondance équipement ↔ besoin :
--
--   equipement_oxygene   ↔ patient_constraint_type 'medical_oxygene'
--   equipement_brancard  ↔ 'medical_brancard' (un véhicule type 'ambulance' est
--                           considéré équipé d'office, cf. fonction de compat)
--   places_tpmr (EXISTANT, 0-3) ↔ 'medical_fauteuil' / 'vehicule_tpmr'
--                           (réutilisé tel quel — PAS de doublon)
--   capacite_charge_kg   ↔ surcharge pondérale (§5.7). Aucun besoin patient
--                           correspondant dans l'enum à ce jour → stocké mais
--                           non vérifié par la compatibilité (à mirrorer côté
--                           patient dans un lot ultérieur si besoin).
--
-- Pattern table conservé : défauts sûrs (un véhicule existant n'a aucun
-- équipement coché), checks de borne, commentaires de colonne. Équipements
-- standards en colonnes ; le « autre » du CdG en champ libre (pas d'enum).
-- RLS inchangée.
-- =============================================================================

alter table public.vehicles
  add column equipement_oxygene boolean not null default false,
  add column equipement_brancard boolean not null default false,
  add column capacite_charge_kg int check (
    capacite_charge_kg is null or capacite_charge_kg between 1 and 2000
  ),
  add column equipement_autre text check (
    equipement_autre is null or length(equipement_autre) <= 200
  );

comment on column public.vehicles.equipement_oxygene is
  'Équipement oxygène (VEHICULE-01, §5.7). Satisfait patient_constraint_type '
  '''medical_oxygene''.';
comment on column public.vehicles.equipement_brancard is
  'Accès brancard (VEHICULE-01, §5.7). Satisfait ''medical_brancard'' ; un '
  'véhicule type ''ambulance'' est considéré équipé d''office.';
comment on column public.vehicles.capacite_charge_kg is
  'Capacité de charge en kg (VEHICULE-01, §5.7, surcharge pondérale). Pas de '
  'besoin patient correspondant à ce jour → non vérifié par la compatibilité.';
comment on column public.vehicles.equipement_autre is
  'Équipement libre non standardisé (VEHICULE-01, §5.7). Informatif, hors compat.';
