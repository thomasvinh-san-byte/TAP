import type { CockpitRide } from './types';

/**
 * Ordre de passage des courses sur la carte du cockpit (COCKPIT-08).
 *
 * L'ordre est produit par une SOURCE remplaçable : aujourd'hui l'heure programmée
 * (chronologique), demain la séquence issue de l'optimisation — sans réécrire les
 * marqueurs. Une source prend la liste des courses et renvoie, par id de course,
 * son numéro d'ordre 1-based. Seules les courses ACTIVES (non terminées) sont
 * numérotées : l'ordre concerne ce qui reste à faire ; les terminées sont estompées
 * et sortent de la numérotation (elles ne décalent pas les numéros).
 */

/** Statut d'une course terminée (réalisée). */
export const RIDE_DONE_STATUS = 'terminee';

/** Vrai si la course est terminée (réalisée) → estompée, hors numérotation. */
export function isRideDone(ride: Pick<CockpitRide, 'status'>): boolean {
  return ride.status === RIDE_DONE_STATUS;
}

/**
 * Source d'ordre : courses → numéro de passage (1-based) par id. Même signature
 * pour la variante chronologique (ici) et, plus tard, la variante optimisée.
 */
export type RideOrderSource = (rides: readonly CockpitRide[]) => Map<string, number>;

/**
 * Ordre CHRONOLOGIQUE : numérote les courses actives par heure programmée
 * croissante (1 = la plus tôt). Les terminées sont exclues. Disponible sans
 * prérequis — la bascule vers l'ordre optimisé se fera en remplaçant cette source.
 */
export const chronologicalOrder: RideOrderSource = (rides) => {
  const active = rides.filter((r) => !isRideDone(r));
  const sorted = [...active].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );
  const order = new Map<string, number>();
  sorted.forEach((r, i) => order.set(r.id, i + 1));
  return order;
};
