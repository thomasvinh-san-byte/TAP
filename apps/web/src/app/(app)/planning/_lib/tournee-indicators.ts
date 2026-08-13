import { DRIVER_LOAD_STATUSES } from '../../cockpit/_lib/driver-load';

/**
 * Indicateurs de tournée par chauffeur (Module 5.12 lot C). HONNÊTETÉ (cf.
 * `driver-load.ts`) : la base ne porte NI durée de course NI amplitude de
 * service. On ne fabrique donc pas d'« heures planifiées » ni de « taux
 * d'occupation » — ce seraient des chiffres faux. On livre ce qui se dérive
 * réellement des courses :
 *   - le NOMBRE de courses affectées (charge brute) ;
 *   - la PLAGE horaire (première → dernière prise en charge) — la respiration
 *     de la journée, pas une amplitude travaillée ;
 *   - la MUTUALISATION : courses rattachées à un groupe d'au moins 2 (même
 *     définition que le tableau de bord — `ride_group_id`), avec le taux.
 *
 * Le gain de mutualisation (km/temps épargnés) exige l'optimiseur et n'est pas
 * persisté : l'appelant affiche « non disponible » plutôt qu'un gain inventé.
 * Logique PURE et testable.
 */

export interface TourneeIndicatorRow {
  driver_id: string | null;
  status: string;
  scheduled_at: string;
  ride_group_id: string | null;
}

export interface TourneeIndicator {
  count: number;
  /** Première prise en charge (ISO) — `null` si aucune course. */
  firstAt: string | null;
  /** Dernière prise en charge (ISO) — `null` si aucune course. */
  lastAt: string | null;
  mutualisees: number;
  /** Part mutualisée (entier %). 0 si aucune course. */
  tauxMutualisation: number;
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

/**
 * Calcule les indicateurs par chauffeur affecté (statuts fermes :
 * `assignee`/`en_cours`/`terminee`, comme la charge du cockpit). Un groupe de
 * mutualisation ne compte que s'il rassemble au moins 2 courses en périmètre.
 */
export function computeTourneeIndicators(
  rows: TourneeIndicatorRow[],
): Map<string, TourneeIndicator> {
  // Périmètre = courses fermes affectées à un chauffeur.
  const scoped = rows.filter(
    (r): r is TourneeIndicatorRow & { driver_id: string } =>
      Boolean(r.driver_id) && DRIVER_LOAD_STATUSES.has(r.status),
  );

  // Taille de chaque groupe (mutualisation = groupe d'au moins 2 courses).
  const groupSize = new Map<string, number>();
  for (const r of scoped) {
    if (r.ride_group_id) {
      groupSize.set(r.ride_group_id, (groupSize.get(r.ride_group_id) ?? 0) + 1);
    }
  }

  const byDriver = new Map<string, TourneeIndicator>();
  for (const r of scoped) {
    const cur =
      byDriver.get(r.driver_id) ??
      ({
        count: 0,
        firstAt: null,
        lastAt: null,
        mutualisees: 0,
        tauxMutualisation: 0,
      } as TourneeIndicator);
    cur.count += 1;
    if (!cur.firstAt || r.scheduled_at < cur.firstAt) cur.firstAt = r.scheduled_at;
    if (!cur.lastAt || r.scheduled_at > cur.lastAt) cur.lastAt = r.scheduled_at;
    if (r.ride_group_id && (groupSize.get(r.ride_group_id) ?? 0) >= 2) cur.mutualisees += 1;
    byDriver.set(r.driver_id, cur);
  }

  for (const ind of byDriver.values()) {
    ind.tauxMutualisation = pct(ind.mutualisees, ind.count);
  }
  return byDriver;
}
