/**
 * Machine à états centralisée du cycle de vie d'une course (DEC-178).
 *
 * SOURCE UNIQUE des transitions de statut, reconstituée FIDÈLEMENT depuis les
 * actions existantes (assignation, conduite, annulation, météo, groupes,
 * replanification) — AUCUNE transition inventée, comportement INCHANGÉ. Même
 * prévention que pour les statuts d'annulation (B1/B2) : une règle métier
 * répétée à la main dans 8+ fichiers devient une table testée.
 *
 * L'atomicité reste portée par le compare-and-set SQL (`.eq('status', …)`,
 * DEC-168) ; cette machine fournit la RÈGLE (statuts source/cible légaux), pas
 * le mécanisme d'atomicité.
 */

import { RIDE_CANCELLED_STATUSES } from './ride';

export const RIDE_STATUSES = [
  'brouillon',
  'validee',
  'assignee',
  'en_cours',
  // PWA-01 (§5.16) : états intermédiaires de la prise en charge.
  'arrive_sur_place',
  'patient_a_bord',
  'terminee',
  'annulee_regulateur',
  'annulee_patient',
  'annulee_chauffeur',
  'annulee_meteo',
] as const;
export type RideStatusValue = (typeof RIDE_STATUSES)[number];

/**
 * Transitions légales `source → cibles`. Origine de chaque arête (vérifié sur
 * main, HEAD #347) :
 *   - brouillon → validee (acceptation demande groupée) / annulee_regulateur (refus)
 *   - validee   → assignee (affectation) / annulee_regulateur (annulation) /
 *                 annulee_patient (no-show) / annulee_meteo (mode météo)
 *   - assignee  → en_cours (démarrage) / validee (désaffectation) / annulee_* (idem)
 *   - en_cours  → arrive_sur_place (arrivé) / annulee_patient (no-show en route)
 *   - arrive_sur_place → patient_a_bord (à bord) / annulee_patient (no-show à l'arrivée)
 *   - patient_a_bord   → terminee (clôture)  [plus d'annulation patient : il est à bord]
 *   - terminee / annulee_* → terminaux (aucune sortie)
 *
 * PWA-01 (§5.16) : la clôture n'est plus directe depuis `en_cours` — la séquence
 * impose arrive_sur_place puis patient_a_bord. `terminee` n'est atteignable que
 * depuis `patient_a_bord` (test explicite : en_cours → terminee illégal).
 *
 * `annulee_chauffeur` : valeur d'enum SANS producteur actuel (aucune action ne
 * l'écrit) → terminal sans arête entrante (tracé registre §14).
 */
export const RIDE_TRANSITIONS: Record<RideStatusValue, readonly RideStatusValue[]> = {
  brouillon: ['validee', 'annulee_regulateur'],
  validee: ['assignee', 'annulee_regulateur', 'annulee_patient', 'annulee_meteo'],
  assignee: ['en_cours', 'validee', 'annulee_regulateur', 'annulee_patient', 'annulee_meteo'],
  en_cours: ['arrive_sur_place', 'annulee_patient'],
  arrive_sur_place: ['patient_a_bord', 'annulee_patient'],
  patient_a_bord: ['terminee'],
  terminee: [],
  annulee_regulateur: [],
  annulee_patient: [],
  annulee_chauffeur: [],
  annulee_meteo: [],
};

/** Vrai si la transition `from → to` est légale. Tolère un `from` inconnu (→ false). */
export function canTransition(from: string, to: RideStatusValue): boolean {
  const allowed = RIDE_TRANSITIONS[from as RideStatusValue];
  return allowed ? allowed.includes(to) : false;
}

/** Statuts source depuis lesquels `to` est atteignable (pour les compare-and-set). */
export function statusesAllowedTo(to: RideStatusValue): RideStatusValue[] {
  return RIDE_STATUSES.filter((s) => RIDE_TRANSITIONS[s].includes(to));
}

/** Statuts d'une course ACTIVE (ni brouillon ni annulée). PWA-01 : inclut les
 *  états intermédiaires arrive_sur_place / patient_a_bord. */
export const ACTIVE_RIDE_STATUSES = [
  'validee',
  'assignee',
  'en_cours',
  'arrive_sur_place',
  'patient_a_bord',
  'terminee',
] as const;
export type ActiveRideStatus = (typeof ACTIVE_RIDE_STATUSES)[number];

/**
 * Statuts depuis lesquels la régulation peut encore modifier / annuler une
 * course AVANT démarrage (édition, annulation régulateur, météo, réaffectation).
 * Dérivé de la machine (= sources d'une annulation météo) → source unique, plus
 * de littéral `['validee','assignee']` dupliqué.
 */
export const RIDE_MODIFIABLE_STATUSES: readonly RideStatusValue[] =
  statusesAllowedTo('annulee_meteo');

/** Vrai si une course à ce statut est encore modifiable/annulable par la régulation. */
export function isModifiableStatus(status: string): boolean {
  return (RIDE_MODIFIABLE_STATUSES as readonly string[]).includes(status);
}

/** Garde de cohérence interne : les cibles d'annulation ∈ RIDE_CANCELLED_STATUSES. */
export function cancellationTargetsAreKnown(): boolean {
  const cancelled = new Set<string>(RIDE_CANCELLED_STATUSES);
  return RIDE_STATUSES.every((from) =>
    RIDE_TRANSITIONS[from].every((to) => !to.startsWith('annulee_') || cancelled.has(to)),
  );
}
