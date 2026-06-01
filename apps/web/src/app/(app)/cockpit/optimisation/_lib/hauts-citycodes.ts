/**
 * Codes INSEE des communes des Hauts de La Réunion.
 *
 * Utilisé pour détecter les groupements traversant des zones de relief
 * où la distance Haversine sous-estime fortement le temps de trajet (D-10).
 *
 * Sources : code officiel géographique INSEE 974.
 * Les codes marqués TODO UAT D-10 sont à confirmer avec la régulatrice
 * lors des tests utilisateurs (UAT) — les communes sont identifiées
 * mais leur code INSEE exact devra être validé terrain.
 */

/** Codes INSEE confirmés dans villes-974.ts */
export const HAUTS_CITYCODES = new Set([
  '97413', // Cilaos (cirque)
  '97433', // Salazie (cirque)
  // TODO UAT D-10 : confirmer les codes ci-dessous
  '97421', // Entre-Deux (zone de hauts)
  '97431', // La Plaine-des-Palmistes (route du volcan)
  '97417', // La Plaine-des-Palmistes (alias)
  '97439', // Sainte-Rose (côte est, accès volcan)
]);

/**
 * Retourne true si au moins un trajet du groupement traverse une zone de Hauts.
 *
 * @param rideCitycodes - Tableau de [pickupCitycode, dropoffCitycode] par course
 */
export function groupTraverseHauts(rideCitycodes: (string | null)[]): boolean {
  return rideCitycodes.some((code) => code !== null && HAUTS_CITYCODES.has(code));
}
