/**
 * Distance Haversine et matrice de distance corrigée pour le solveur local
 * (Phase 06.12 — heuristique TS native).
 *
 * Port direct de `apps/web/py/solver/haversine.py` (D-02). Aucune dépendance
 * tierce, stdlib seule.
 */

export const EARTH_RADIUS_KM = 6371;

/**
 * Distance Haversine entre deux points géographiques, en kilomètres.
 * Formule standard (rayon Terre 6371 km).
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Matrice NxN de distances Haversine × facteur de correction routier (DEC-056).
 * `coords[0]` = dépôt fictif. Diagonale nulle, matrice symétrique.
 */
export function distanceMatrix(
  coords: ReadonlyArray<readonly [number, number]>,
  correctionFactor: number,
): number[][] {
  const n = coords.length;
  const m: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    const row: number[] = [];
    const ci = coords[i]!;
    for (let j = 0; j < n; j += 1) {
      const cj = coords[j]!;
      row.push(haversineKm(ci[0], ci[1], cj[0], cj[1]) * correctionFactor);
    }
    m.push(row);
  }
  return m;
}
