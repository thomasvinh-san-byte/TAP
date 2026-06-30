-- =============================================================================
-- Migration — Compétences et langues du chauffeur — CHAUFFEUR-02, §5.6
-- =============================================================================
-- Première brique du bloc « préférences chauffeur [NOUVEAU] » du §5.6 : les deux
-- attributs d'affectation les plus simples (énumérations fermées, sans
-- référentiel externe) :
--   - competences : accueil personnes âgées, gestion fauteuil, conduite douce
--   - langues     : français, créole, anglais
--
-- Modélisation : colonnes text[] sur `drivers` (comme `type_permis`), plus simple
-- qu'une table de liaison pour des énumérations fermées et peu nombreuses.
--
-- Pas de check DB (comme `type_permis`) : la validation est centralisée dans
-- @tap/shared (driver_competence / driver_langue), pour ne pas exiger une
-- migration à chaque nouvelle valeur métier. Hors solveur : ces attributs
-- éclairent l'affectation, ils n'entrent pas dans le moteur d'optimisation.
--
-- RLS inchangée (la table garde ses policies existantes).
-- =============================================================================

alter table public.drivers
  add column competences text[] not null default '{}',
  add column langues text[] not null default '{}';

comment on column public.drivers.competences is
  'Compétences chauffeur (CHAUFFEUR-02, §5.6) — énumération fermée validée côté '
  '@tap/shared (driver_competence). Pas de check DB (extensible sans migration).';
comment on column public.drivers.langues is
  'Langues parlées (CHAUFFEUR-02, §5.6) — énumération fermée validée côté '
  '@tap/shared (driver_langue). Pas de check DB (extensible sans migration).';
