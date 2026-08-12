import { RIDE_CANCELLED_STATUSES, type RideCancelledStatus } from '@tap/shared';

/**
 * KPIs opérationnels dérivables DIRECTEMENT des courses (Lot 5.20-A). Calcul PUR
 * et testable — aucune donnée inventée : chaque indicateur se dérive d'une
 * colonne réelle de `rides`. Si aucune course sur la période, `total = 0` et
 * l'appelant affiche « non disponible » plutôt qu'un 0 % trompeur.
 *
 * Sources :
 * - mutualisation : `ride_group_id` (course rattachée à un groupe d'AU MOINS 2
 *   courses — un groupe d'une seule course n'est pas une mutualisation) ;
 * - annulation : `status ∈ RIDE_CANCELLED_STATUSES`, réparti par catégorie de
 *   motif = le statut d'annulation (structuré et normé, ≠ `cancel_motif` texte
 *   libre) ;
 * - patient absent : `no_show_at` non nul (même signal que le dashboard) ;
 * - récurrentes vs ponctuelles : `ride_recurrence_id` (nul = ponctuelle).
 */

export interface OperationalRideRow {
  status: string;
  no_show_at: string | null;
  ride_group_id: string | null;
  ride_recurrence_id: string | null;
}

/** Libellés FR des catégories de motif d'annulation (= statut d'annulation). */
export const CANCELLED_STATUS_LABEL: Record<RideCancelledStatus, string> = {
  annulee_regulateur: 'Régulateur',
  annulee_patient: 'Patient',
  annulee_chauffeur: 'Chauffeur',
  annulee_meteo: 'Météo',
};

export interface OperationalKpis {
  total: number;
  mutualisees: number;
  tauxMutualisation: number;
  annulees: number;
  tauxAnnulation: number;
  annulationParMotif: { statut: RideCancelledStatus; label: string; count: number }[];
  patientAbsent: number;
  tauxPatientAbsent: number;
  recurrentes: number;
  ponctuelles: number;
  tauxRecurrentes: number;
}

const CANCELLED = new Set<string>(RIDE_CANCELLED_STATUSES);

/** Pourcentage entier (0 si dénominateur nul — jamais de division par zéro). */
function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export function aggregateOperationalKpis(rows: OperationalRideRow[]): OperationalKpis {
  const total = rows.length;

  // 1re passe : taille de chaque groupe (mutualisation = groupe d'au moins 2).
  const groupSize = new Map<string, number>();
  for (const r of rows) {
    if (r.ride_group_id) groupSize.set(r.ride_group_id, (groupSize.get(r.ride_group_id) ?? 0) + 1);
  }

  let mutualisees = 0;
  let annulees = 0;
  let patientAbsent = 0;
  let recurrentes = 0;
  const byMotif = new Map<string, number>();

  for (const r of rows) {
    if (r.ride_group_id && (groupSize.get(r.ride_group_id) ?? 0) >= 2) mutualisees += 1;
    if (CANCELLED.has(r.status)) {
      annulees += 1;
      byMotif.set(r.status, (byMotif.get(r.status) ?? 0) + 1);
    }
    if (r.no_show_at) patientAbsent += 1;
    if (r.ride_recurrence_id) recurrentes += 1;
  }

  const annulationParMotif = RIDE_CANCELLED_STATUSES.map((statut) => ({
    statut,
    label: CANCELLED_STATUS_LABEL[statut],
    count: byMotif.get(statut) ?? 0,
  })).filter((m) => m.count > 0);

  return {
    total,
    mutualisees,
    tauxMutualisation: pct(mutualisees, total),
    annulees,
    tauxAnnulation: pct(annulees, total),
    annulationParMotif,
    patientAbsent,
    tauxPatientAbsent: pct(patientAbsent, total),
    recurrentes,
    ponctuelles: total - recurrentes,
    tauxRecurrentes: pct(recurrentes, total),
  };
}
