-- =============================================================================
-- Migration — régime de prise en charge + refus transport partagé (Facturation 1)
-- =============================================================================
-- Ajoute au TRANSPORT (rides) les attributs conventionnels nécessaires à la
-- ventilation assurance / patient et à la traçabilité du refus de transport
-- partagé. Attributs portés par le TRANSPORT (en cohérence avec la prescription
-- liée), PAS dérivés du seul statut patient : l'exonération dépend du LIEN entre
-- le transport et l'affection (un patient en ALD transporté pour une cause sans
-- lien relève du taux général).
--
-- La LOGIQUE de calcul (taux, ticket modérateur, franchise, effet du refus) vit
-- dans @tap/pricing (prise-en-charge.ts), paramétrable (config versionnée) —
-- ces colonnes ne stockent que les ENTRÉES du calcul (taux, motif, refus). La
-- ventilation part assurance / part patient est DÉRIVÉE au moment de la facture
-- (doctrine D-09 : la facture ne stocke pas de montant recalculable), ce qui
-- évite toute dérive si le tarif change.
--
-- NON modélisé (signalé) : la MINORATION du remboursement sur refus (décret
-- d'application non paru) → non stockée, non appliquée.
-- =============================================================================

alter table public.rides
  -- Taux de prise en charge (%) applicable à CE transport. NULL = taux général
  -- (65 %) appliqué par le calcul. 100 = exonéré, 55 = ALD non exonérante.
  add column prise_en_charge_taux smallint
    check (prise_en_charge_taux is null or prise_en_charge_taux in (100, 65, 55)),
  -- Motif d'exonération / régime particulier (le cas échéant). Distingue les
  -- cas 100 % et pilote l'exonération de franchise / le périmètre du refus.
  add column exoneration_motif text
    check (
      exoneration_motif is null
      or exoneration_motif in ('ald_lien', 'accident_travail', 'maternite', 'css', 'ame')
    ),
  -- Refus du transport partagé par l'assuré (traçabilité). Conséquence (perte
  -- du tiers payant, mention sur facture) calculée en aval selon le périmètre
  -- (soins itératifs, hors CSS/AME).
  add column transport_partage_refuse boolean not null default false;

comment on column public.rides.prise_en_charge_taux is
  'Taux de prise en charge assurance maladie (%). NULL=taux general (65). 100=exonere, 55=ALD non exonerante. Attribut du transport (lien affection), pas du seul statut patient.';
comment on column public.rides.exoneration_motif is
  'Motif exoneration/regime: ald_lien / accident_travail / maternite / css / ame. Distingue les prises en charge a 100 % + pilote franchise et perimetre refus partage.';
comment on column public.rides.transport_partage_refuse is
  'Refus du transport partage par l''assure. Effet (hors tiers payant + mention conventionnelle) applique pour soins iteratifs hors CSS/AME. Minoration NON appliquee (decret non paru).';
