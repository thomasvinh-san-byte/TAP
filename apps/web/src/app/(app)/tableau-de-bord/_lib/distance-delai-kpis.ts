import { RIDE_CANCELLED_STATUSES, reunionDayKey } from '@tap/shared';
import { haversineKm } from '@/lib/optimizer/haversine';

/**
 * KPIs distance / délai du mois (Lot 5.20-B) — calcul PUR et testable.
 *
 * Honnêteté (garde-fou du lot) : la distance n'est PAS mesurée (pas d'OSRM en
 * base) mais ESTIMÉE par Haversine × facteur de correction routier (DEC-056,
 * même méthode que l'optimiseur et `packages/pricing` `haversine_corrige`). Le
 * libellé UI dit « estimé ». Toute course sans coordonnées complètes est
 * EXCLUE du calcul de distance (jamais de valeur inventée).
 *
 * Définitions :
 * - courses « réalisées » = ni annulées (`RIDE_CANCELLED_STATUSES`) ni absence
 *   patient (`no_show_at`) : seules ces courses ont produit un trajet.
 * - km EN CHARGE = pickup → dropoff (patient à bord), estimé Haversine ×
 *   facteur, moyenné sur les courses réalisées disposant des 4 coordonnées.
 * - km À VIDE = trajets d'approche entre deux courses consécutives d'un MÊME
 *   chauffeur le MÊME jour (dropoff de la précédente → pickup de la suivante).
 *   Ratio à vide / en charge = signal d'optimisation des tournées.
 * - délai moyen de prise en charge = moyenne signée (`started_at` −
 *   `scheduled_at`) en minutes, sur les courses effectivement démarrées
 *   (`started_at` non nul). Positif = retard.
 */

/** Facteur de correction routier (DEC-056) — distance route ≈ vol d'oiseau × 1,3. */
export const ROAD_CORRECTION_FACTOR = 1.3;

export interface DistanceDelaiRideRow {
  driver_id: string | null;
  status: string;
  no_show_at: string | null;
  scheduled_at: string;
  started_at: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
}

export interface DistanceDelaiKpis {
  /** Courses réalisées (ni annulées, ni no-show) sur la période. */
  ridesRealisees: number;
  /** Courses réalisées disposant des 4 coordonnées (base du km en charge). */
  ridesAvecDistance: number;
  kmEnChargeTotal: number;
  /** km moyen / course en charge (0 si aucune course estimable). */
  kmMoyenParCourse: number;
  kmAVideTotal: number;
  /** Ratio à vide / en charge en % (0 si aucun km en charge). */
  ratioAVidePct: number;
  /** Courses effectivement démarrées (base du délai). */
  ridesAvecDelai: number;
  /** Délai moyen de prise en charge en minutes, signé (0 si aucune donnée). */
  delaiMoyenMin: number;
}

const CANCELLED = new Set<string>(RIDE_CANCELLED_STATUSES);

function hasPickup(r: DistanceDelaiRideRow): boolean {
  return r.pickup_lat !== null && r.pickup_lng !== null;
}
function hasDropoff(r: DistanceDelaiRideRow): boolean {
  return r.dropoff_lat !== null && r.dropoff_lng !== null;
}

/** km estimé entre deux points = Haversine × facteur de correction routier. */
function estimatedKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  return haversineKm(aLat, aLng, bLat, bLng) * ROAD_CORRECTION_FACTOR;
}

export function aggregateDistanceDelaiKpis(rows: DistanceDelaiRideRow[]): DistanceDelaiKpis {
  const realisees = rows.filter((r) => !CANCELLED.has(r.status) && r.no_show_at === null);

  // --- km EN CHARGE (pickup → dropoff), courses réalisées avec 4 coords -------
  let kmEnChargeTotal = 0;
  let ridesAvecDistance = 0;
  for (const r of realisees) {
    if (hasPickup(r) && hasDropoff(r)) {
      kmEnChargeTotal += estimatedKm(r.pickup_lat!, r.pickup_lng!, r.dropoff_lat!, r.dropoff_lng!);
      ridesAvecDistance += 1;
    }
  }

  // --- km À VIDE : chaînage par chauffeur et par jour (fuseau Réunion) --------
  // On ne relie jamais deux jours ni deux chauffeurs différents.
  let kmAVideTotal = 0;
  const chains = new Map<string, DistanceDelaiRideRow[]>();
  for (const r of realisees) {
    if (!r.driver_id) continue; // sans chauffeur assigné, pas de tournée chaînable
    const key = `${r.driver_id}|${reunionDayKey(r.scheduled_at)}`;
    const list = chains.get(key);
    if (list) list.push(r);
    else chains.set(key, [r]);
  }
  for (const list of chains.values()) {
    list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1]!;
      const cur = list[i]!;
      if (hasDropoff(prev) && hasPickup(cur)) {
        kmAVideTotal += estimatedKm(
          prev.dropoff_lat!,
          prev.dropoff_lng!,
          cur.pickup_lat!,
          cur.pickup_lng!,
        );
      }
    }
  }

  // --- délai moyen de prise en charge (started_at − scheduled_at) ------------
  let delaiSommeMin = 0;
  let ridesAvecDelai = 0;
  for (const r of realisees) {
    if (!r.started_at) continue;
    const diffMin = (new Date(r.started_at).getTime() - new Date(r.scheduled_at).getTime()) / 60000;
    if (Number.isFinite(diffMin)) {
      delaiSommeMin += diffMin;
      ridesAvecDelai += 1;
    }
  }

  return {
    ridesRealisees: realisees.length,
    ridesAvecDistance,
    kmEnChargeTotal,
    kmMoyenParCourse: ridesAvecDistance > 0 ? kmEnChargeTotal / ridesAvecDistance : 0,
    kmAVideTotal,
    ratioAVidePct: kmEnChargeTotal > 0 ? Math.round((kmAVideTotal / kmEnChargeTotal) * 100) : 0,
    ridesAvecDelai,
    delaiMoyenMin: ridesAvecDelai > 0 ? Math.round(delaiSommeMin / ridesAvecDelai) : 0,
  };
}
