/**
 * Logique PURE de l'historique des incidents patient (PATIENT-01, CdG §5.2).
 *
 * Aucune dépendance serveur (`server-only`) ni Supabase : module partagé entre
 * la query RSC (`incidents.ts`) et la section UI client
 * (`patient-incidents-section.client.tsx`).
 *
 * Choix de la fenêtre glissante (documenté) : on retient une FENÊTRE TEMPORELLE
 * de 90 jours plutôt qu'un comptage « sur les N derniers transports ». Un
 * incident n'est pas toujours rattaché à une course (`ride_id` est optionnel :
 * plainte hors transport, conflit signalé a posteriori), donc un comptage indexé
 * sur les courses laisserait des incidents hors décompte. La fenêtre temporelle
 * est simple, lisible par la régulatrice et reste pertinente métier (un patient
 * avec 3 incidents en 3 mois mérite l'attention du dirigeant). À rendre
 * paramétrable par organisation ultérieurement (à valider avec le dirigeant).
 */

export type PatientIncidentType =
  | 'retard'
  | 'refus_paiement'
  | 'conflit_chauffeur'
  | 'plainte'
  | 'autre';

/** Ordre d'affichage stable des types (récap + formulaire). */
export const PATIENT_INCIDENT_TYPES: readonly PatientIncidentType[] = [
  'retard',
  'refus_paiement',
  'conflit_chauffeur',
  'plainte',
  'autre',
] as const;

export const PATIENT_INCIDENT_TYPE_LABELS: Record<PatientIncidentType, string> = {
  retard: 'Retard',
  refus_paiement: 'Refus de paiement',
  conflit_chauffeur: 'Conflit chauffeur',
  plainte: 'Plainte',
  autre: 'Autre',
};

/** Fenêtre glissante du compteur d'incidents (jours). */
export const INCIDENT_WINDOW_DAYS = 90;

/**
 * Seuil d'escalade dirigeant : à partir de ce nombre d'incidents sur la
 * fenêtre glissante, l'historique passe en alerte visuelle forte.
 *
 * À rendre paramétrable par organisation ultérieurement (à valider avec le
 * dirigeant). Pas de notification active à ce stade : alerte visuelle seule.
 */
export const INCIDENT_ESCALADE_SEUIL = 3;

/** Vrai si le nombre d'incidents sur la fenêtre franchit le seuil d'escalade. */
export function isEscalated(windowTotal: number): boolean {
  return windowTotal >= INCIDENT_ESCALADE_SEUIL;
}

/** État visuel (calqué sur le pattern KpiCard) selon le total sur la fenêtre. */
export type IncidentTone = 'neutre' | 'attention' | 'alerte';

export function incidentToneForTotal(windowTotal: number): IncidentTone {
  if (windowTotal === 0) return 'neutre';
  if (isEscalated(windowTotal)) return 'alerte';
  return 'attention';
}
