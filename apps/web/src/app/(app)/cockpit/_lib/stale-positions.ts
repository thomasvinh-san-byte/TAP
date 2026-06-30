import type { CockpitAlert, CockpitRide } from './types';
import { POSITION_STALE_MIN, type DriverPosition } from './use-driver-positions';

/**
 * Détection « géolocalisation périmée pour chauffeur en service » (§5.13,
 * COCKPIT-02). Promeut le signal visuel passif (couleur en sourdine au-delà du
 * seuil) en ALERTE. Logique PURE (sur le modèle de `unassigned-h1.ts`).
 *
 * « En service » (critère retenu, documenté) : le chauffeur a au moins une
 * course du jour de statut `assignee` ou `en_cours` (assignée et non terminée).
 * Sans ce filtre, un chauffeur au repos avec une position ancienne génèrerait
 * un faux positif permanent — c'est le cœur du lot.
 *
 * Cas « aucune position » : un chauffeur en service SANS aucune position remontée
 * compte comme périmé (pas de remontée du tout = perte de visibilité). `captured_at`
 * vaut alors `null`.
 *
 * Seuil réutilisé : `POSITION_STALE_MIN` (5 min), partagé avec l'affichage.
 */

/** Statuts considérés « en service » (affecté et non terminé). */
export const EN_SERVICE_STATUSES: ReadonlySet<string> = new Set(['assignee', 'en_cours']);

export interface StalePositionDriver {
  driver_id: string;
  /** Dernier `captured_at` connu, ou `null` si aucune position. */
  captured_at: string | null;
}

/** Identifiants des chauffeurs en service aujourd'hui (depuis les courses). */
export function enServiceDriverIds(rides: CockpitRide[]): Set<string> {
  const ids = new Set<string>();
  for (const r of rides) {
    if (r.driver_id && EN_SERVICE_STATUSES.has(r.status)) ids.add(r.driver_id);
  }
  return ids;
}

/**
 * Chauffeurs en service dont la dernière position date de plus de
 * `POSITION_STALE_MIN`, ou qui n'ont aucune position. Triés du plus périmé au
 * moins périmé (aucune position d'abord, puis position la plus ancienne).
 */
export function findStalePositionDrivers(
  rides: CockpitRide[],
  positionsByDriver: Map<string, DriverPosition>,
  nowMs: number,
): StalePositionDriver[] {
  const out: StalePositionDriver[] = [];
  for (const driverId of enServiceDriverIds(rides)) {
    const pos = positionsByDriver.get(driverId);
    if (!pos) {
      out.push({ driver_id: driverId, captured_at: null });
      continue;
    }
    const ageMin = (nowMs - new Date(pos.captured_at).getTime()) / 60_000;
    if (ageMin > POSITION_STALE_MIN) {
      out.push({ driver_id: driverId, captured_at: pos.captured_at });
    }
  }
  return out.sort((a, b) => {
    if (a.captured_at === null) return b.captured_at === null ? 0 : -1;
    if (b.captured_at === null) return 1;
    return new Date(a.captured_at).getTime() - new Date(b.captured_at).getTime();
  });
}

/** Convertit en alertes cockpit (type dédié `driver_position_stale`). */
export function stalePositionsToAlerts(
  stale: StalePositionDriver[],
  driverLabels: Record<string, string>,
  nowMs: number,
): CockpitAlert[] {
  return stale.map((s) => ({
    id: `driver-position-stale:${s.driver_id}`,
    ride_id: null,
    event_type: 'driver_position_stale',
    payload: { driver_label: driverLabels[s.driver_id] ?? 'Chauffeur', captured_at: s.captured_at },
    created_at: new Date(nowMs).toISOString(),
  }));
}
