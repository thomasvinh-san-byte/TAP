/**
 * Helpers de calcul du delta N vs N-1 — Wave 1 Phase 06.11 (A4 pattern
 * Stripe Balance déjà adopté Phase 04.7).
 *
 * Pure functions : pas de dépendance Supabase, testables isolément.
 */

/**
 * Delta relatif en pourcentage entier. Renvoie `undefined` si `prev === 0`
 * (pas de comparatif pertinent — éviter division par zéro et signalement
 * trompeur du type « ↗ +∞% »).
 */
export function deltaPercent(curr: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return Math.round(((curr - prev) / prev) * 100);
}

/**
 * Delta absolu en points — pour les KPI qui sont déjà des pourcentages
 * (taux d'incidents, taux de mutualisation, etc.). Évite l'ambiguïté
 * « +12% sur un taux qui est déjà en % ».
 */
export function deltaPoints(curr: number, prev: number): number {
  return Math.round(curr - prev);
}
