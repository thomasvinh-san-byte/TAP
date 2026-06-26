-- =============================================================================
-- Migration — Référent légal du patient (DEC-172, T3)
-- =============================================================================
-- CdG l.139-140 : pour un patient mineur ou sous tutelle, le contact référent
-- (parent / tuteur) est OBLIGATOIRE. Le statut « mineur » est DÉRIVÉ de
-- date_naissance (pas de booléen stocké redondant — source unique). L'obligation
-- est portée par un AVERTISSEMENT à la saisie de course (non bloquant brutal,
-- pattern bon expiré 07.06), pas par une contrainte SQL.
--
-- Colonnes additives NULLABLE → patients existants inchangés (rétrocompat).
-- `referent_document_url` prévue pour le scan futur (autorisation parentale /
-- jugement de tutelle) mais laissée NULL : le scan dépend du HDS, comme les bons
-- de transport (tracé registre). AUCUN Storage câblé ici.
-- =============================================================================

alter table public.patients
  add column referent_nom text,
  add column referent_lien text,
  add column referent_telephone text,
  add column referent_type text
    check (referent_type is null or referent_type in ('parental', 'tutelle')),
  add column referent_document_url text;

comment on column public.patients.referent_nom is
  'Nom du référent légal (parent / tuteur) — DEC-172, CdG l.139-140.';
comment on column public.patients.referent_lien is
  'Lien du référent avec le patient (parent, tuteur, autre) — texte libre.';
comment on column public.patients.referent_telephone is
  'Téléphone du référent légal.';
comment on column public.patients.referent_type is
  'Type d''autorité : parental | tutelle (null si non renseigné).';
comment on column public.patients.referent_document_url is
  'Scan autorisation parentale / jugement de tutelle. NULL en V1 (dépend HDS).';
