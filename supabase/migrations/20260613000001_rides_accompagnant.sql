-- =============================================================================
-- Migration — Accompagnant sur la course (DEC-172, T2)
-- =============================================================================
-- CdG l.293 / l.256 (champ de saisie attendu) + règle CPAM (ameli.fr) :
-- un accompagnant est pris en charge si le médecin le juge nécessaire (mineur,
-- handicap, troubles de l'orientation) et remboursé au même taux que le patient.
--
-- 3 colonnes additives, NULLABLE / défauts → courses existantes strictement
-- inchangées (rétrocompat). Le coût de l'accompagnant payant est intégré au
-- calcul via la grille tarifaire (supplement_accompagnant_eur, migration
-- suivante), JAMAIS hardcodé (DEC-057, moteur de pricing inchangé).
-- =============================================================================

alter table public.rides
  add column accompagnant boolean not null default false,
  add column accompagnant_payant boolean not null default false,
  add column accompagnant_identite text;

comment on column public.rides.accompagnant is
  'Présence d''un accompagnant (DEC-172, CdG l.293). Occupe une place véhicule.';
comment on column public.rides.accompagnant_payant is
  'Accompagnant facturé (sinon gratuit). Si true, supplément appliqué via la grille.';
comment on column public.rides.accompagnant_identite is
  'Identité libre de l''accompagnant (optionnel).';
