import type { ReassignConflict } from './planning-conflicts';

/**
 * Verdict PUR d'une dépose de course sur une ligne de la grille planning
 * (Module 5.12, lot dispatch — retour visuel constraint-aware AVANT le drop).
 * Sépare la logique (testable) de son rendu : la grille colore et libelle la
 * ligne survolée d'après ce verdict pendant un glisser.
 *
 * On ne BLOQUE jamais (le conflit reste PROBABLE, cf. `planning-conflicts.ts`) :
 * le verdict `conflict` déclenche une confirmation à la dépose, pas un refus.
 */
export type DropVerdict = 'noop' | 'unassign' | 'compatible' | 'conflict';

export interface DropEvaluation {
  verdict: DropVerdict;
  /** Libellé FR court (accompagne TOUJOURS la couleur — WCAG 1.4.1). */
  label: string;
}

/**
 * Évalue la dépose de la course déplacée (chauffeur courant `currentDriverId`)
 * sur la ligne cible `targetDriverId` (`null` = « Non affectées »), au vu du
 * conflit horaire probable déjà détecté (`conflict`, réutilise
 * `detectReassignConflict`). Pur : aucune dépendance React/DOM.
 */
export function evaluateDrop(
  currentDriverId: string | null,
  targetDriverId: string | null,
  conflict: ReassignConflict | null,
): DropEvaluation {
  // Cible = ligne d'origine → aucune action (dépose neutre).
  if ((targetDriverId ?? null) === (currentDriverId ?? null)) {
    return {
      verdict: 'noop',
      label: targetDriverId ? 'Déjà sur ce chauffeur' : 'Déjà non affectée',
    };
  }
  // Cible = « Non affectées » → désaffectation, toujours saine.
  if (targetDriverId === null) {
    return { verdict: 'unassign', label: "Retirer l'affectation" };
  }
  // Chevauchement horaire probable → confirmation à la dépose (jamais bloqué).
  if (conflict) {
    return { verdict: 'conflict', label: 'Conflit horaire probable' };
  }
  return { verdict: 'compatible', label: 'Créneau compatible' };
}
