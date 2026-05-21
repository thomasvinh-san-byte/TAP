import type { CourseFacturable } from './queries-facturation';

/**
 * Agrégation de la facture CGSS — fonction PURE (Phase 06 PLAN-2).
 *
 * Regroupe les courses facturables par chauffeur avec sous-totaux, et calcule
 * le total. La facture AGRÈGE les `tarif_amount_eur` déjà stockés — elle ne
 * recalcule rien (D-09).
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
}

export function aggregateFacture(courses: CourseFacturable[]): FactureAggregate {
  const map = new Map<string, ChauffeurGroup>();
  for (const c of courses) {
    let g = map.get(c.driver_id);
    if (!g) {
      g = {
        driverId: c.driver_id,
        driverNom: c.driver_nom,
        count: 0,
        subtotalEur: 0,
        courses: [],
      };
      map.set(c.driver_id, g);
    }
    g.count += 1;
    g.subtotalEur += c.tarif_amount_eur;
    g.courses.push(c);
  }
  const groups = [...map.values()].sort((a, b) => a.driverNom.localeCompare(b.driverNom, 'fr'));
  const totalEur = courses.reduce((s, c) => s + c.tarif_amount_eur, 0);
  return { groups, totalEur, count: courses.length };
}
