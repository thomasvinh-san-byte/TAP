import { haversineKm } from '@/lib/optimizer/haversine';

/**
 * KPIs économiques du mois (Lot 5.20-E) — calcul PUR et testable.
 *
 * Honnêteté (garde-fou du lot) : la marge est une ESTIMATION (coût/km paramétré
 * × distance estimée Haversine × facteur routier 1,3, même méthode que le lot B
 * et l'optimiseur). Sans paramètres de coût saisis, `configured = false` →
 * l'UI affiche « non configuré » (jamais un zéro trompeur).
 *
 * Périmètre COHÉRENT : CA et coût portent sur le MÊME ensemble — les courses
 * terminées du mois disposant des 4 coordonnées (estimables). Les courses sans
 * coordonnées sont exclues (comptées en couverture), jamais valorisées à zéro.
 *
 * Rentabilité mutualisé vs non : une course est mutualisée si son groupe compte
 * au moins 2 courses (même définition que les KPIs opérationnels, lot A).
 */

/** Facteur de correction routier (DEC-056) — cohérent avec le lot B. */
export const ROAD_CORRECTION_FACTOR = 1.3;

export interface EconomicRideRow {
  tarif_amount_eur: number | null;
  ride_group_id: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
}

export interface EconomicKpis {
  /** false si aucun paramètre de coût saisi → l'UI affiche « non configuré ». */
  configured: boolean;
  coutParKm: number;
  /** Courses terminées estimables (4 coordonnées) — base du calcul. */
  ridesEstimables: number;
  kmEnChargeTotal: number;
  caRealiseTotal: number;
  coutEstimeTotal: number;
  margeBrute: number;
  /** Marge sur courses mutualisées (groupe ≥ 2). */
  margeMutualisees: number;
  /** Marge sur courses non mutualisées. */
  margeNonMutualisees: number;
}

function estimatedKm(r: EconomicRideRow): number | null {
  if (r.pickup_lat === null || r.pickup_lng === null) return null;
  if (r.dropoff_lat === null || r.dropoff_lng === null) return null;
  return (
    haversineKm(r.pickup_lat, r.pickup_lng, r.dropoff_lat, r.dropoff_lng) * ROAD_CORRECTION_FACTOR
  );
}

/**
 * @param coutParKm coût total €/km (carburant + entretien + amortissement), ou
 *   `null` si les paramètres de coût ne sont pas configurés.
 */
export function aggregateEconomicKpis(
  rows: EconomicRideRow[],
  coutParKm: number | null,
): EconomicKpis {
  const empty = (configured: boolean, cout: number): EconomicKpis => ({
    configured,
    coutParKm: cout,
    ridesEstimables: 0,
    kmEnChargeTotal: 0,
    caRealiseTotal: 0,
    coutEstimeTotal: 0,
    margeBrute: 0,
    margeMutualisees: 0,
    margeNonMutualisees: 0,
  });

  if (coutParKm === null) return empty(false, 0);

  // Taille de chaque groupe pour distinguer mutualisées (≥ 2) vs non.
  const groupSize = new Map<string, number>();
  for (const r of rows) {
    if (r.ride_group_id) groupSize.set(r.ride_group_id, (groupSize.get(r.ride_group_id) ?? 0) + 1);
  }

  let ridesEstimables = 0;
  let kmEnChargeTotal = 0;
  let caRealiseTotal = 0;
  let caMut = 0;
  let kmMut = 0;
  let caNon = 0;
  let kmNon = 0;

  for (const r of rows) {
    const km = estimatedKm(r);
    if (km === null) continue;
    const ca = Number(r.tarif_amount_eur ?? 0);
    ridesEstimables += 1;
    kmEnChargeTotal += km;
    caRealiseTotal += ca;
    const mutualisee = r.ride_group_id !== null && (groupSize.get(r.ride_group_id) ?? 0) >= 2;
    if (mutualisee) {
      caMut += ca;
      kmMut += km;
    } else {
      caNon += ca;
      kmNon += km;
    }
  }

  const coutEstimeTotal = coutParKm * kmEnChargeTotal;

  return {
    configured: true,
    coutParKm,
    ridesEstimables,
    kmEnChargeTotal,
    caRealiseTotal,
    coutEstimeTotal,
    margeBrute: caRealiseTotal - coutEstimeTotal,
    margeMutualisees: caMut - coutParKm * kmMut,
    margeNonMutualisees: caNon - coutParKm * kmNon,
  };
}
