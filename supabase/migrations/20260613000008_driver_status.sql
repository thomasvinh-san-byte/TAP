-- =============================================================================
-- Migration — Statut chauffeur explicite (driver_status) — CHAUFFEUR-01, §5.6
-- =============================================================================
-- Le §5.6 prévoit quatre statuts : actif, en congé, suspendu, archivé. Le modèle
-- actuel n'avait que deux booléens (`actif`, `archive`) incapables de distinguer
-- « en congé » de « suspendu » (les deux = actif=false). On introduit un statut
-- explicite, SEULE SOURCE DE VÉRITÉ.
--
-- RÉTROCOMPATIBILITÉ (choix documenté) : les colonnes `actif` et `archive` sont
-- CONSERVÉES mais DÉRIVÉES de `status` par un trigger BEFORE INSERT/UPDATE
-- (`drivers__status_sync`). De nombreux lecteurs s'appuient encore sur ces
-- booléens (tableau de bord, cache liste chauffeurs, row-actions, rowKey UI) :
-- les dériver évite de tous les migrer d'un coup tout en garantissant qu'il n'y
-- a PAS deux sources de vérité contradictoires — `status` commande, les booléens
-- suivent. Les ÉCRIVAINS (Server Actions) écrivent désormais `status` ; toute
-- valeur passée à `actif`/`archive` est écrasée par le trigger.
--
-- Pourquoi un trigger et pas des colonnes GENERATED : le garde-fou existant
-- `drivers_archive_columns_guard` est un trigger BEFORE UPDATE qui lit
-- `new.archive` ; or la valeur d'une colonne GENERATED n'est pas encore calculée
-- dans un trigger BEFORE (elle serait NULL). Un trigger de synchronisation qui
-- s'exécute AVANT le garde-fou (ordre alphabétique : `drivers__status_sync` <
-- `drivers_archive_columns_guard`) pose `new.archive` à temps pour que le
-- garde-fou « seul un dirigeant peut archiver » continue de fonctionner.
-- =============================================================================

-- -- Section 1 — Enum driver_status ---------------------------------------------
create type public.driver_status as enum ('actif', 'conge', 'suspendu', 'archive');

-- -- Section 2 — Colonne status + migration des données -------------------------
alter table public.drivers
  add column status public.driver_status not null default 'actif';

-- Migration des données : archive prime ; sinon actif → actif, !actif → suspendu.
-- (« désactivé » historique = indisponible non archivé → mappé sur 'suspendu',
-- le congé étant une notion nouvelle saisie explicitement par la suite.)
update public.drivers
set status = case
  when archive then 'archive'::public.driver_status
  when actif then 'actif'::public.driver_status
  else 'suspendu'::public.driver_status
end;

-- -- Section 3 — Trigger de synchronisation des booléens hérités ----------------
-- Dérive actif/archive depuis status à chaque écriture. Nom préfixé `__` pour
-- s'exécuter AVANT `drivers_archive_columns_guard` (cf. en-tête).
create or replace function public.drivers_sync_legacy_flags()
returns trigger language plpgsql set search_path = public as $$
begin
  new.actif := (new.status = 'actif');
  new.archive := (new.status = 'archive');
  return new;
end; $$;

comment on function public.drivers_sync_legacy_flags() is
  'Dérive drivers.actif/archive depuis drivers.status (source de vérité unique, '
  'CHAUFFEUR-01). S''exécute avant le garde-fou d''archivage dirigeant.';

create trigger drivers__status_sync
  before insert or update on public.drivers
  for each row execute function public.drivers_sync_legacy_flags();

-- -- Section 4 — Index ----------------------------------------------------------
-- L'ancien index partiel (organization_id, actif) where archive=false servait le
-- filtre « disponible » (actif=true). Le nouveau filtre d'affectation est
-- status='actif'. On remplace par un index (organization_id, status) qui sert à
-- la fois la liste d'affectation (status='actif') et la vue admin par statut.
drop index if exists public.drivers_organization_actif_idx;
create index drivers_organization_status_idx
  on public.drivers (organization_id, status);

-- RLS inchangée (la table garde ses policies existantes).
