/**
 * Suggestion d'un chauffeur par groupement (D-… optimisation → affectation).
 *
 * L'optimiseur raisonne en VÉHICULES ; l'affectation à un CHAUFFEUR est l'étape
 * suivante du flux standard « optimiser puis affecter ». Règle SIMPLE et
 * DÉTERMINISTE (pas d'algorithme complexe) :
 *   - répartition équilibrée : on affecte au chauffeur le MOINS chargé ;
 *   - jamais deux tournées qui se chevauchent au même chauffeur (un chauffeur ne
 *     conduit qu'un véhicule à la fois) ;
 *   - si aucun chauffeur libre ne convient, le groupement reste NON affecté
 *     (`null`) — on n'affecte pas à vide.
 *
 * La suggestion n'est qu'une proposition : le régulateur la voit et peut la
 * changer avant de valider (garde-fou « validation humaine » du transport de
 * patients). Fonction PURE (testable), sans I/O ni React.
 */

/** Fenêtre temporelle d'un groupement (bornes en ms epoch) + sa clé (vehicle_id). */
export interface GroupWindow {
  key: string;
  startMs: number;
  endMs: number;
}

export interface DriverRef {
  id: string;
}

function windowsOverlap(a: readonly [number, number], startMs: number, endMs: number): boolean {
  return a[0] <= endMs && startMs <= a[1];
}

/**
 * Renvoie, par clé de groupement, l'id du chauffeur suggéré (ou `null` si aucun
 * chauffeur libre). Déterministe : mêmes entrées → même sortie.
 */
export function suggestDriversForGroupements(
  groups: readonly GroupWindow[],
  drivers: readonly DriverRef[],
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const driverIds = [...drivers].map((d) => d.id).sort();
  if (driverIds.length === 0) {
    for (const g of groups) result[g.key] = null;
    return result;
  }

  // Traiter les groupements dans un ordre stable (heure de début, puis clé).
  const ordered = [...groups].sort((a, b) => a.startMs - b.startMs || (a.key < b.key ? -1 : 1));
  const load = new Map<string, number>(driverIds.map((id) => [id, 0]));
  const assignedWindows = new Map<string, Array<[number, number]>>(driverIds.map((id) => [id, []]));

  for (const g of ordered) {
    let best: string | null = null;
    let bestLoad = Number.POSITIVE_INFINITY;
    for (const id of driverIds) {
      const busy = assignedWindows.get(id)!;
      if (busy.some((w) => windowsOverlap(w, g.startMs, g.endMs))) continue;
      const l = load.get(id)!;
      // Moins chargé d'abord ; à charge égale, l'ordre stable des ids tranche.
      if (l < bestLoad) {
        bestLoad = l;
        best = id;
      }
    }
    result[g.key] = best;
    if (best) {
      load.set(best, load.get(best)! + 1);
      assignedWindows.get(best)!.push([g.startMs, g.endMs]);
    }
  }
  return result;
}
