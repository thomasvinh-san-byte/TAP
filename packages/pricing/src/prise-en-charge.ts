/**
 * Régime de prise en charge conventionnel — Facturation bloc 1.
 *
 * Calcule, pour UN transport, la ventilation part assurance maladie / part
 * patient (ticket modérateur), la franchise médicale, et l'effet du refus de
 * transport partagé sur le tiers payant. Fonction PURE : la configuration
 * (taux, franchise) est passée en paramètre (doctrine grille versionnée
 * DEC-057) — AUCUNE valeur réglementaire en dur dans la logique.
 *
 * Règles reflétées (convention CNAM, vérifiées à la source) :
 *   - cas général : 65 % (ticket modérateur 35 % à la charge du patient) ;
 *   - ALD exonérante EN LIEN avec l'affection : 100 % ;
 *   - ALD NON exonérante : 55 % (nuance à ne pas confondre) ;
 *   - 100 % aussi : AT/MP, maternité (≥ 6e mois), CSS, AME ;
 *   - le régime est un attribut du TRANSPORT (lien affection), pas du seul statut ;
 *   - franchise médicale : 2 €/trajet (plafonds 4 €/jour, 50 €/an — voir NOTE),
 *     exonérée pour maternité, CSS, AME, urgence ;
 *   - refus du transport partagé (soins itératifs, hors CSS/AME) : perte du
 *     tiers payant (le patient avance les frais) + mention conventionnelle.
 *
 * NON implémenté volontairement (signalé) :
 *   - MINORATION du remboursement en cas de refus : décret d'application NON
 *     paru → règle NON active. Le modèle peut l'accueillir plus tard (champ de
 *     config `minorationRefusPct` prévu, appliqué seulement si > 0).
 *   - PLAFONDS de franchise (jour/an) : approximation V1 = franchise par trajet
 *     sans plafond cumulé (nécessite une agrégation multi-trajets) — à affiner.
 */

/** Motif d'exonération (100 %) ou de régime particulier, porté par le transport. */
export type ExonerationMotif = 'ald_lien' | 'accident_travail' | 'maternite' | 'css' | 'ame';

/** Taux de prise en charge applicable au transport (%). */
export type PriseEnChargeTaux = 100 | 65 | 55;

/** Mention conventionnelle EXACTE à porter sur la facture en cas de refus. */
export const MENTION_REFUS_TRANSPORT_PARTAGE =
  "L'assuré(e) refuse le transport partagé et paie directement le transporteur sans dispense d'avance de frais";

/** Configuration versionnée du régime — paramétrable (pas de valeur en dur). */
export interface PriseEnChargeConfig {
  version: string;
  tauxGeneralPct: number;
  tauxAldNonExonerantPct: number;
  tauxExonerePct: number;
  franchiseParTrajetEur: number;
  /** Plafonds informatifs — NON appliqués en V1 (voir NOTE module). */
  franchisePlafondJourEur: number;
  franchisePlafondAnEur: number;
  /** Motifs exonérant de franchise (l'urgence exonère via un drapeau séparé). */
  franchiseExonerationMotifs: readonly ExonerationMotif[];
  /** Motifs hors périmètre « perte du tiers payant sur refus de partage ». */
  refusPartageExclusMotifs: readonly ExonerationMotif[];
  /** Minoration du remboursement sur refus (%). 0 = inactif (décret non paru). */
  minorationRefusPct: number;
}

/** Configuration de référence 2026 (convention CNAM). À versionner en base. */
export const PRISE_EN_CHARGE_CONFIG_V1: PriseEnChargeConfig = {
  version: '2026-conv-cnam-v1',
  tauxGeneralPct: 65,
  tauxAldNonExonerantPct: 55,
  tauxExonerePct: 100,
  franchiseParTrajetEur: 2,
  franchisePlafondJourEur: 4,
  franchisePlafondAnEur: 50,
  franchiseExonerationMotifs: ['maternite', 'css', 'ame'],
  refusPartageExclusMotifs: ['css', 'ame'],
  minorationRefusPct: 0, // décret non paru → inactif
};

export interface PriseEnChargeInput {
  tarifEur: number;
  /** Taux stocké sur le transport ; null → taux général de la config. */
  taux?: PriseEnChargeTaux | null;
  exonerationMotif?: ExonerationMotif | null;
  transportPartageRefuse?: boolean;
  /** Le refus n'a de conséquence que pour des soins itératifs (réguliers). */
  soinsIteratifs?: boolean;
  /** Transport d'urgence → exonère la franchise. */
  urgence?: boolean;
  config?: PriseEnChargeConfig;
}

export interface PriseEnChargeResult {
  tauxPct: number;
  /** Part remboursée par l'assurance (0 si hors tiers payant). */
  partAssuranceEur: number;
  /** Ce que le patient règle au transporteur (ticket modérateur, ou tout si hors TP). */
  partPatientEur: number;
  /** Ticket modérateur théorique (tarif − part assurance au taux). */
  ticketModerateurEur: number;
  /** Franchise médicale due (matière caisse/patient, hors montant transporteur). */
  franchiseEur: number;
  /** Le tiers payant s'applique-t-il (faux si refus de partage dans le périmètre). */
  tiersPayantApplicable: boolean;
  /** Le refus de partage produit-il ses effets réglementaires. */
  refusPartagePris: boolean;
  /** Mention conventionnelle à porter sur la facture (null si non applicable). */
  mentionRefusPartage: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Taux applicable : explicite sur le transport, sinon taux général de la config. */
function resolveTauxPct(input: PriseEnChargeInput, config: PriseEnChargeConfig): number {
  if (input.taux != null) return input.taux;
  return config.tauxGeneralPct;
}

export function computePriseEnCharge(input: PriseEnChargeInput): PriseEnChargeResult {
  const config = input.config ?? PRISE_EN_CHARGE_CONFIG_V1;
  const tarif = input.tarifEur > 0 ? round2(input.tarifEur) : 0;
  const motif = input.exonerationMotif ?? null;

  const tauxPct = resolveTauxPct(input, config);

  // Franchise : 2 €/trajet sauf urgence ou motif exonérant. Plafonds non appliqués.
  const franchiseExoneree =
    input.urgence === true || (motif !== null && config.franchiseExonerationMotifs.includes(motif));
  const franchiseEur = franchiseExoneree ? 0 : config.franchiseParTrajetEur;

  // Refus de transport partagé : effets seulement pour soins itératifs et hors
  // CSS/AME. La minoration reste inactive (décret non paru).
  const refusPartagePris =
    input.transportPartageRefuse === true &&
    input.soinsIteratifs === true &&
    !(motif !== null && config.refusPartageExclusMotifs.includes(motif));

  const tiersPayantApplicable = !refusPartagePris;

  const partAssuranceTheorique = round2((tarif * tauxPct) / 100);
  const ticketModerateurEur = round2(tarif - partAssuranceTheorique);

  let partAssuranceEur: number;
  let partPatientEur: number;
  if (tiersPayantApplicable) {
    // Tiers payant : l'assurance couvre sa part, le patient règle le ticket modérateur.
    partAssuranceEur = partAssuranceTheorique;
    partPatientEur = ticketModerateurEur;
  } else {
    // Hors tiers payant : le patient avance la TOTALITÉ (remboursement ultérieur
    // par sa caisse, hors périmètre de la facture transporteur).
    partAssuranceEur = 0;
    partPatientEur = tarif;
  }

  return {
    tauxPct,
    partAssuranceEur,
    partPatientEur,
    ticketModerateurEur,
    franchiseEur,
    tiersPayantApplicable,
    refusPartagePris,
    mentionRefusPartage: refusPartagePris ? MENTION_REFUS_TRANSPORT_PARTAGE : null,
  };
}
