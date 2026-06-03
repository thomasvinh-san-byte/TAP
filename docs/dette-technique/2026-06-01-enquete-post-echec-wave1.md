# Enquête post-échec Wave 1 Tentative 1 — config `functions` sur chemin arbitraire (2026-06-01)

## Diagnostic de l'échec

La PR `feat/06.10-01-vercel-python-py-relocate` (commit `a11863c`, merge `834d1c3`) a échoué au build Vercel avec :

```
Error: The pattern "py/solver/index.py" defined in `functions` doesn't match any Serverless Functions.
Learn More: https://vercel.link/unmatched-function-pattern
```

Le déplacement physique du Python hors de `/api/` (étape clé non encore essayée par les 5 PR précédentes) a bien été réalisé, mais la config `vercel.json functions` n'a pas accepté le chemin `py/solver/index.py`.

## Cause racine confirmée

La documentation Vercel `vercel.com/docs/functions/runtimes/python` ne documente en 2026 que des fonctions Python placées dans `api/**/*.py`. La clé `functions` semble exclusive à ce répertoire conventionnel — un chemin arbitraire comme `py/**/*.py` n'est pas reconnu par le matcher.

Conséquence : impossible de cohabiter Python serverless + Next.js Route Handlers via la config moderne `functions`, **à moins** que le Python soit dans `/api/` (cas conflictuel avec le routing Next.js qui a fait échouer les 5 PR précédentes #196..#199).

## Voie restante côté Vercel — config legacy `builds`/`routes`

La documentation `vercel.com/docs/project-configuration/vercel-json` confirme en 2026 que la config legacy `builds`/`routes` :

- accepte explicitement des chemins arbitraires comme `src`,
- supporte le builder `@vercel/python` sur ces chemins arbitraires (exemple documenté : `"src": "*.py", "use": "@vercel/python"`),
- exige de déclarer aussi le builder Next.js (`@vercel/next` sur `package.json`) car `builds` désactive l'auto-détection du framework.

**Décision dirigeant 2026-06-01** : tenter cette config legacy en dernière chance Vercel (1-2 h max). Si échec → bascule TypeScript/WASM.

## Options TypeScript/WASM si Wave 1 Tentative 2 échoue

Identifiées pour cadrage de Phase 06.11 (à discuss séparément).

### Option A — `reinterpretcat/vrp` Rust + WASM

- Projet actif (~472 étoiles, commits récents 2025-2026).
- Bibliothèque Rust de résolution de VRP riche (Pickup & Delivery Time Windows, multi-vehicle, contraintes complexes).
- Compilable en WASM, exécutable dans Node.js (côté Route Handler) ou directement côté browser.
- Avantage : qualité d'optimisation proche d'OR-Tools, stack TS-friendly.
- Risque : courbe d'apprentissage Rust + WASM bindings.

### Option B — Refactor TS heuristique custom

- Réécriture en TypeScript natif d'une heuristique simple (clarke-wright, savings algorithm, ou approche gloutonne).
- Qualité d'optimisation moindre que OR-Tools mais probablement acceptable pour 10-30 courses/jour (volume bêta).
- Avantage : 100 % stack TypeScript, zéro friction, contrat zod inchangé.
- Risque : qualité moindre, mais le mock actuel produit aussi des regroupements 2-par-2 simples et la régulatrice les accepte — l'usage réel ne demande peut-être pas plus.

### Option C — `node_or_tools` Mapbox — éliminée

Projet abandonné, pas de commits depuis 2020. Hors course.

## Option Render — exclue par directive dirigeant

Render Starter Docker ($7/mois container warm) est explicitement écarté par instruction dirigeant 2026-06-01. Pas d'ajout de fournisseur récurrent au budget infra bêta.

## Trajectoire

1. **Wave 1 Tentative 2** (cette PR) : config legacy `builds`/`routes` Vercel. Critère d'abandon ferme : 2 h.
2. **Si succès** : Wave 2 (geocoding) reste planifiée comme prévu en Phase 06.10.
3. **Si échec** : Phase 06.11 « Refactor solveur TypeScript/WASM » à discuss séparément, options A et B comparées en détail.

---

*Enquête synthétisée 2026-06-01 après échec build Vercel. Sources : doc Vercel functions/runtimes/python, doc Vercel project-configuration/vercel-json, GitHub reinterpretcat/vrp, GitHub mapbox/node_or_tools.*
