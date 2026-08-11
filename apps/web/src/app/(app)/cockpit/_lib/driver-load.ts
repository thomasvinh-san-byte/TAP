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

/** Chauffeur du référentiel actif (drivers.id → nom), pour inclure les 0 course. */
export interface DriverRosterEntry {
  id: string;
  nom_affichage: string;
}

export interface DriverBalanceEntry extends DriverLoad {
  /** Charge maximale du jour ET il existe un déséquilibre (quelqu'un a moins). */
  isMostLoaded: boolean;
  /** 0 course affectée alors que d'autres en ont : le plus disponible. */
  isAvailable: boolean;
}

export interface DriverBalanceResult {
  entries: DriverBalanceEntry[];
  /** Charge maximale (échelle de la barre) — 0 si aucune course comptée. */
  max: number;
  /** Total des courses affectées comptées (somme des charges). */
  totalAssigned: number;
}

/**
 * Vue d'ÉQUILIBRAGE (dispatch) — étend `computeDriverLoads` sans fausser le
 * comptage : on AJOUTE les chauffeurs actifs sans course du jour (les plus
 * disponibles, barre vide) depuis le référentiel `roster`, et on marque les
 * extrêmes pour faire ressortir le déséquilibre. Les repères ne sont posés que
 * s'il y a un déséquilibre réel (max > 0 et tout le monde n'est pas à égalité) —
 * accent réservé aux extrêmes, pas de bruit quand la charge est équilibrée.
 */
export function computeDriverBalance(
  rides: CockpitRide[],
  roster: readonly DriverRosterEntry[] = [],
  driverLabels: Record<string, string> = {},
): DriverBalanceResult {
  const { loads, max } = computeDriverLoads(rides, driverLabels);
  const counted = new Set(loads.map((l) => l.driver_id));

  // Chauffeurs actifs SANS course du jour → 0 (les plus actionnables).
  const zeros: DriverLoad[] = roster
    .filter((d) => !counted.has(d.id))
    .map((d) => ({ driver_id: d.id, nom: d.nom_affichage, count: 0 }));

  const merged = [...loads, ...zeros].sort(
    (a, b) => b.count - a.count || a.nom.localeCompare(b.nom, 'fr'),
  );

  // Déséquilibre = charge non uniforme (au moins un chauffeur sous le maximum).
  const hasImbalance = max > 0 && merged.some((l) => l.count < max);

  const entries: DriverBalanceEntry[] = merged.map((l) => ({
    ...l,
    isMostLoaded: hasImbalance && l.count === max,
    isAvailable: hasImbalance && l.count === 0,
  }));

  const totalAssigned = loads.reduce((s, l) => s + l.count, 0);
  return { entries, max, totalAssigned };
}

/**
 * Première course RÉAFFECTABLE du jour d'un chauffeur (pour redistribuer) : la
 * plus tôt encore `assignee` (pas démarrée, donc réaffectable sans friction) ; à
 * défaut la plus tôt tout statut de charge confondu. `null` si aucune course
 * (chauffeur disponible) — l'appelant n'ouvre alors pas de drawer.
 */
export function firstReassignableRideId(rides: CockpitRide[], driverId: string): string | null {
  const mine = rides
    .filter((r) => r.driver_id === driverId && DRIVER_LOAD_STATUSES.has(r.status))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const assignable = mine.find((r) => r.status === 'assignee');
  return (assignable ?? mine[0])?.id ?? null;
}
