# Deferred items — Phase 01.5 DPA + RGPD compliance

## Pre-existing test failure (out of scope of Plan 03)

**Discovered:** Plan 1.5-03 execution (2026-05-07).
**Test:** `packages/shared/src/validators/__tests__/common.test.ts` → `siretSchema accepte un SIRET valide (Carrefour)`.
**Failure:** Le SIRET de test `40483304800010` échoue le contrôle Luhn de `siretSchema` dans `packages/shared/src/validators/common.ts`.
**Hors-scope :** Ce test échouait déjà avant le démarrage du Plan 03 (vérifié via `git stash` + replay). Le Plan 03 ne modifie ni `common.ts` ni `common.test.ts`.
**Probable cause:** Soit le SIRET de test n'est pas réellement valide Luhn (mauvais fixture), soit `verifyLuhn` a un bug d'algorithme. À investiguer dans un plan dédié `validators/common` ou en correctif Plan 1 standalone.
**Suggested next plan:** correctif `fix(shared): SIRET Luhn check` (1 fichier, ≤ 1h).
