# ADR-001 — Monorepo Turborepo + pnpm workspaces

- **Statut** : Accepté
- **Date** : 2026-05-06
- **Auteur** : Guillaume

## Contexte

Le projet réunit 4 applications distinctes (web régulateur, PWA chauffeur, admin, portail B2B) qui partagent une grande partie de leur logique : moteur de tarification CGSS, génération de courses récurrentes, types Supabase, validators Zod, composants UI.

Trois architectures ont été envisagées :

1. **Multi-repos** : un dépôt par app, un dépôt par package partagé, publication npm interne.
2. **Monorepo « plat »** (un seul `package.json`) : tout dans une seule app Next.js.
3. **Monorepo workspaces** : un dépôt avec apps et packages versionnés ensemble.

## Décision

Monorepo **Turborepo + pnpm workspaces**, avec la structure définie dans `CLAUDE.md` § 4.

- pnpm comme package manager (vitesse, isolation stricte des dépendances, taille du `node_modules`)
- Turborepo pour le pipeline de build (cache local + distant, parallélisation, ne rebuilder que ce qui change)

## Alternatives considérées

### Multi-repos
- **Pour** : isolation stricte, déploiements indépendants
- **Contre** : versionning des packages partagés douloureux pour un solo founder, refacto cross-cutting très coûteuse, lenteur d'itération
- **Verdict** : trop de friction pour 1 personne, on bascule en multi-repos plus tard si besoin

### Nx
- **Pour** : tooling très complet, generators
- **Contre** : courbe d'apprentissage plus raide, opinions plus fortes, plus lourd à configurer
- **Verdict** : Turborepo couvre nos besoins avec moins de configuration

### Yarn workspaces
- **Pour** : standard historique
- **Contre** : moins rapide que pnpm, hoisting peu prédictible
- **Verdict** : pnpm + Turborepo est la combinaison qui domine 2025/2026 pour ce type de stack

## Conséquences

**Positives**
- Refactos cross-cutting triviaux (déplacer un type, renommer un export)
- Tests RLS, pricing, recurrence isolés dans des packages purement TypeScript
- CI mutualisée, cache Turborepo accélère les pipelines
- Une seule source de vérité pour les types Supabase

**Négatives / vigilance**
- Risque de coupling implicite entre packages : à surveiller avec `eslint-plugin-import` et conventions de dépendances (`apps/*` peut dépendre de `packages/*`, jamais l'inverse)
- Installation locale plus lourde au démarrage (mitigé par pnpm)
- Si à terme on doit isoler une app (revente, open source partiel), il faudra extraire — faisable mais coûteux
