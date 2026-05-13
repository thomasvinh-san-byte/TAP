# Phase 04 — Deferred items (out-of-scope discoveries)

Suivi des défauts pré-existants découverts pendant l'exécution mais
**hors scope** des plans Phase 04 (Rule SCOPE BOUNDARY — Claude exec).

## ESLint v10 cassé sur le repo entier (pré-existant)

**Découvert** : PLAN-3 exec (W2), commande `pnpm lint`.

**Symptôme** :
- `@tap/shared` et `@tap/database` : `ESLint couldn't find an eslint.config.(js|mjs|cjs) file` (ESLint v10 ne lit plus `.eslintrc.*`)
- `apps/web` : `next lint` prompt interactif (config jamais initialisée)

**Cause** : la version ESLint installée (`10.1.0`) impose le flat config format ; le repo a encore des `.eslintrc.*` (V8). Migration jamais faite.

**Impact** : `pnpm lint` rouge par défaut. Le typecheck `pnpm typecheck` reste vert (3 packages).

**Scope** : tooling repo. Non causé par les changements PLAN-3. À traiter dans une PR dédiée (`chore(tooling): migrate ESLint flat config + Next lint setup`).

**Décision** : ne PAS bloquer Phase 04. Verifier la non-régression via `pnpm typecheck` (vert) + revue manuelle des fichiers modifiés.
