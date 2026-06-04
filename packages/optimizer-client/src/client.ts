/**
 * Module historiquement client HTTP du microservice Python OR-Tools.
 *
 * Phase 06.12 (ADR-010) : le solveur a été réécrit en heuristique TS native
 * dans `apps/web/src/lib/optimizer/`. Plus de microservice Python, plus
 * d'appel HTTP, plus de mock — le Route Handler appelle directement
 * `solveLocal()`.
 *
 * Ce fichier est conservé vide pour préserver l'historique git ; il sera
 * supprimé du barrel `index.ts` à la prochaine itération si plus aucun
 * import ne référence ses anciens symboles.
 */

export {};
