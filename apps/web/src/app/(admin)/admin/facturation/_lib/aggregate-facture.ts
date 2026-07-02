import { computePriseEnCharge, type ExonerationMotif, type PriseEnChargeTaux } from '@tap/pricing';
import type { CourseFacturable } from './queries-facturation';

/**
 * Agrégation de la facture CGSS — fonction PURE (Phase 06 PLAN-2).
 *
 * Regroupe les courses facturables par chauffeur avec sous-totaux, et calcule
 * le total. La facture AGRÈGE les `tarif_amount_eur` déjà stockés — elle ne
 * recalcule PAS le tarif (D-09).
 *
 * Facturation bloc 1 : elle DÉRIVE en plus la ventilation part assurance / part
 * patient (ticket modérateur) et la franchise à partir du régime porté par le
 * transport (taux, motif d'exonération, refus de transport partagé), via le
 * module paramétrable @tap/pricing (aucun taux en dur). Les montants dérivés ne
 * sont pas stockés (évite la dérive si le tarif change).
 */

export interface ChauffeurGroup {
  driverId: string;
  driverNom: string;
  count: number;
  subtotalEur: number;
  courses: CourseFacturable[];
}

export interface FactureAggregate {
  groups: ChauffeurGroup[];
  totalEur: number;
  count: number;
  /** Ventilation conventionnelle dérivée (bloc 1). */
  totalAssuranceEur: number;
  totalPatientEur: number;
  totalFranchiseEur: number;
  /** Au moins une course où le refus de transport partagé produit ses effets. */
  hasRefusTransportPartage: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Ventilation d'une course selon son régime (dérivée, non stockée). */
export function ventilationCourse(c: CourseFacturable): ReturnType<typeof computePriseEnCharge> {
  return computePriseEnCharge({
    tarifEur: c.tarif_amount_eur,
    taux: (c.prise_en_charge_taux as PriseEnChargeTaux | null) ?? null,
    exonerationMotif: (c.exoneration_motif as ExonerationMotif | null) ?? null,
    transportPartageRefuse: c.transport_partage_refuse,
    // Approximation V1 : « soins itératifs » ≈ course rattachée à une
    // prescription (transport programmé/récurrent). Détection fine à affiner.
    soinsIteratifs: c.has_prescription,
  });
}

export function aggregateFacture(courses: CourseFacturable[]): FactureAggregate {
  const map = new Map<string, ChauffeurGroup>();
  let totalAssuranceEur = 0;
  let totalPatientEur = 0;
  let totalFranchiseEur = 0;
  let hasRefusTransportPartage = false;

  for (const c of courses) {
    let g = map.get(c.driver_id);
    if (!g) {
      g = { driverId: c.driver_id, driverNom: c.driver_nom, count: 0, subtotalEur: 0, courses: [] };
      map.set(c.driver_id, g);
    }
    g.count += 1;
    g.subtotalEur += c.tarif_amount_eur;
    g.courses.push(c);

    const v = ventilationCourse(c);
    totalAssuranceEur += v.partAssuranceEur;
    totalPatientEur += v.partPatientEur;
    totalFranchiseEur += v.franchiseEur;
    if (v.refusPartagePris) hasRefusTransportPartage = true;
  }

  const groups = [...map.values()].sort((a, b) => a.driverNom.localeCompare(b.driverNom, 'fr'));
  const totalEur = courses.reduce((s, c) => s + c.tarif_amount_eur, 0);
  return {
    groups,
    totalEur: round2(totalEur),
    count: courses.length,
    totalAssuranceEur: round2(totalAssuranceEur),
    totalPatientEur: round2(totalPatientEur),
    totalFranchiseEur: round2(totalFranchiseEur),
    hasRefusTransportPartage,
  };
}
