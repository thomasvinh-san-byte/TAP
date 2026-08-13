import type { CockpitRide } from '../../cockpit/_lib/types';
import { DRIVER_LOAD_STATUSES } from '../../cockpit/_lib/driver-load';

/**
 * Détection de conflit à la réaffectation (Module 5.12 lot B). HONNÊTETÉ : la
 * base ne porte AUCUNE durée de course ni amplitude de service (cf.
 * `driver-load.ts`). On ne peut donc pas calculer un vrai chevauchement
 * d'intervalles. On livre un signal PROBABLE et documenté : deux prises en
 * charge du même chauffeur trop rapprochées dans le temps. Le libellé côté UI
 * dit « probable » — on n'affirme pas un conflit certain qu'on ne peut pas
 * prouver, et on ne BLOQUE jamais (alerte, pas verrou).
 *
 * L'amplitude max n'est pas connue → aucune alerte de dépassement d'amplitude
 * (pas de faux positif). Si cette donnée est ajoutée un jour, elle se branchera
 * ici sans changer l'appelant.
 */

/** Fenêtre de rapprochement (minutes) au-delà de laquelle on n'alerte pas. */
export const CONFLICT_WINDOW_MINUTES = 30;

export interface ReassignConflict {
  /** Nombre de courses du chauffeur cible en rapprochement avec la course déplacée. */
  count: number;
  /** Heure (ISO) de la course en conflit la plus proche — pour l'afficher. */
  nearestScheduledAt: string;
}

function minutesBetween(a: string, b: string): number {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb) / 60000;
}

/**
 * Cherche un chevauchement horaire PROBABLE si l'on réaffecte `movedRideId` au
 * chauffeur `targetDriverId`. `null` = pas de conflit détecté (dont : cible =
 * « non affectées », donc `targetDriverId` nul ; une désaffectation ne crée
 * jamais de conflit). Logique PURE et testable.
 */
export function detectReassignConflict(
  rides: CockpitRide[],
  movedRideId: string,
  targetDriverId: string | null,
  windowMinutes: number = CONFLICT_WINDOW_MINUTES,
): ReassignConflict | null {
  if (!targetDriverId) return null;
  const moved = rides.find((r) => r.id === movedRideId);
  if (!moved) return null;

  let count = 0;
  let nearest: string | null = null;
  let nearestGap = Number.POSITIVE_INFINITY;

  for (const r of rides) {
    if (r.id === movedRideId) continue;
    if (r.driver_id !== targetDriverId) continue;
    if (!DRIVER_LOAD_STATUSES.has(r.status)) continue;
    const gap = minutesBetween(moved.scheduled_at, r.scheduled_at);
    if (gap <= windowMinutes) {
      count += 1;
      if (gap < nearestGap) {
        nearestGap = gap;
        nearest = r.scheduled_at;
      }
    }
  }

  return count > 0 && nearest ? { count, nearestScheduledAt: nearest } : null;
}
