import type { CockpitRide } from './types';

/**
 * Charge RELATIVE par chauffeur (§5.13, COCKPIT-03) — nombre de courses du jour
 * par chauffeur affecté. Décision actée (option A) : PAS de pourcentage
 * d'occupation (ni durée de course ni amplitude de service en base). On livre une
 * mesure honnête (un compte) plutôt qu'un taux précis et faux.
 *
 * Statuts comptés (« charge du jour », documenté) : courses AFFECTÉES non
 * annulées — `assignee`, `en_cours`, `terminee` (le fait inclut ce qui est déjà
 * réalisé). `brouillon` est déjà exclu en amont (cockpit) ; les `annulee_*` ne
 * comptent pas. Une course SANS `driver_id` n'entre dans la charge de personne
 * (couverte par l'alerte H-1). Logique PURE et testable.
 */

export const DRIVER_LOAD_STATUSES: ReadonlySet<string> = new Set([
  'assignee',
  'en_cours',
  'terminee',
]);

export interface DriverLoad {
  driver_id: string;
  nom: string;
  count: number;
}

export interface DriverLoadResult {
  loads: DriverLoad[];
  /** Charge maximale (échelle de la jauge) — 0 si aucune course comptée. */
  max: number;
}

/**
 * Compte les courses du jour par chauffeur affecté, triées par charge
 * décroissante. `driverLabels` complète le nom si la jointure `driver` manque
 * (course arrivée en temps réel sans enrichissement).
 */
export function computeDriverLoads(
  rides: CockpitRide[],
  driverLabels: Record<string, string> = {},
): DriverLoadResult {
  const counts = new Map<string, number>();
  const names = new Map<string, string>();

  for (const r of rides) {
    if (!r.driver_id || !DRIVER_LOAD_STATUSES.has(r.status)) continue;
    counts.set(r.driver_id, (counts.get(r.driver_id) ?? 0) + 1);
    const name = r.driver?.nom_affichage ?? driverLabels[r.driver_id];
    if (name && !names.has(r.driver_id)) names.set(r.driver_id, name);
  }

  const loads: DriverLoad[] = Array.from(counts.entries())
    .map(([driver_id, count]) => ({
      driver_id,
      nom: names.get(driver_id) ?? 'Chauffeur',
      count,
    }))
    .sort((a, b) => b.count - a.count || a.nom.localeCompare(b.nom, 'fr'));

  const max = loads.reduce((m, l) => Math.max(m, l.count), 0);
  return { loads, max };
}
