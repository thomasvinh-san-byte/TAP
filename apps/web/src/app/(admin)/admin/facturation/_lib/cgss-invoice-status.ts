/**
 * Sémantique NORMÉE du cycle de vie des factures CGSS (G3, tiers payant).
 *
 * Source unique des libellés FR, du mapping événement → statut, des transitions
 * proposables et des familles de rejet. Établie au Lot 1 (contraintes en base) ;
 * ce module l'expose à l'UI et aux actions. Aucun montant (D-09).
 */

export const CGSS_STATUSES = [
  'a_teletransmettre',
  'teletransmise',
  'reception_confirmee',
  'rejet_technique',
  'en_traitement_caisse',
  'payee',
  'rejetee',
  'partiellement_payee',
] as const;
export type CgssStatus = (typeof CGSS_STATUSES)[number];

export const CGSS_STATUS_LABEL: Record<CgssStatus, string> = {
  a_teletransmettre: 'À télétransmettre',
  teletransmise: 'Télétransmise',
  reception_confirmee: 'Réception confirmée',
  rejet_technique: 'Rejet technique',
  en_traitement_caisse: 'En traitement caisse',
  payee: 'Payée',
  rejetee: 'Rejetée',
  partiellement_payee: 'Partiellement payée',
};

/** Statut par défaut d'une course CGSS pur pas encore entrée dans le cycle. */
export const CGSS_DEFAULT_STATUS: CgssStatus = 'a_teletransmettre';

/** Classes de badge par statut — accent réservé aux états sensibles (rejets). */
export function cgssStatusTone(status: CgssStatus): string {
  switch (status) {
    case 'payee':
      return 'border-success/30 bg-success/10 text-success';
    case 'rejetee':
    case 'rejet_technique':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    case 'partiellement_payee':
      return 'border-warning/30 bg-warning/10 text-warning';
    default:
      return 'border-border bg-muted text-foreground';
  }
}

export const CGSS_EVENT_TYPES = [
  'teletransmission',
  'arl_positif',
  'arl_negatif',
  'traitement_caisse',
  'paiement',
  'rejet',
  'paiement_partiel',
] as const;
export type CgssEventType = (typeof CGSS_EVENT_TYPES)[number];

export const CGSS_EVENT_LABEL: Record<CgssEventType, string> = {
  teletransmission: 'Télétransmission',
  arl_positif: 'ARL positif (réception confirmée)',
  arl_negatif: 'ARL négatif (rejet technique)',
  traitement_caisse: 'Traitement caisse',
  paiement: 'Paiement (NOEMIE)',
  rejet: 'Rejet (NOEMIE)',
  paiement_partiel: 'Paiement partiel',
};

/** Mapping normé événement → statut résultant (1:1, déterministe). */
export const EVENT_TO_STATUS: Record<CgssEventType, CgssStatus> = {
  teletransmission: 'teletransmise',
  arl_positif: 'reception_confirmee',
  arl_negatif: 'rejet_technique',
  traitement_caisse: 'en_traitement_caisse',
  paiement: 'payee',
  rejet: 'rejetee',
  paiement_partiel: 'partiellement_payee',
};

/** Événements de rejet : exigent un motif (+ famille) — contrainte Lot 1. */
export const REJECT_EVENTS: readonly CgssEventType[] = ['arl_negatif', 'rejet'];

export function isRejectEvent(event: CgssEventType): boolean {
  return REJECT_EVENTS.includes(event);
}

export const CGSS_MOTIF_FAMILLES = [
  'correction_metier',
  'correction_parametrage',
  'incident_technique',
  'dossier_caisse',
  'ecart_amc_dre',
] as const;
export type CgssMotifFamille = (typeof CGSS_MOTIF_FAMILLES)[number];

export const CGSS_MOTIF_FAMILLE_LABEL: Record<CgssMotifFamille, string> = {
  correction_metier: 'Correction métier',
  correction_parametrage: 'Correction paramétrage',
  incident_technique: 'Incident technique',
  dossier_caisse: 'Dossier caisse',
  ecart_amc_dre: 'Écart AMC / DRE',
};

/**
 * Transitions PROPOSABLES depuis un statut (état-machine léger, guide l'UI).
 * Permissif mais cohérent : on n'offre pas d'événement absurde (ex. « paiement »
 * sur une course pas encore télétransmise), sans bloquer les retransmissions
 * (rejet → télétransmission). Les contraintes dures restent en base (Lot 1).
 */
export function allowedEventsFor(status: CgssStatus): CgssEventType[] {
  switch (status) {
    case 'a_teletransmettre':
      return ['teletransmission'];
    case 'teletransmise':
      return ['arl_positif', 'arl_negatif'];
    case 'reception_confirmee':
      return ['traitement_caisse', 'paiement', 'paiement_partiel', 'rejet'];
    case 'en_traitement_caisse':
      return ['paiement', 'paiement_partiel', 'rejet'];
    case 'rejet_technique':
    case 'rejetee':
      // Retransmission après correction (le traitement dédié arrive au Lot 4).
      return ['teletransmission'];
    case 'partiellement_payee':
      return ['paiement', 'rejet'];
    case 'payee':
      return [];
    default:
      return [];
  }
}
