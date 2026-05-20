# PLAN-1 — Bloc F : dettes CI D1/D2/D3

**Phase** : 06 Facturation CGSS + audit sécurité + dettes CI
**Wave** : 1/3 (verdir la CI avant les blocs A et E)
**Dépendances** : aucune (démarre direct — critical path)
**Estimation** : 2-3 h
**Refs** : VISION.md § « Stratégie CI/qualité V1.5 → V3 » (D1/D2/D3), CONCERNS.md § « Dette CI rouge constante » + § « Dettes CI V1.5 », DEC-032 CD push exclusif

---

## Goal

Résoudre les 3 dettes CI V1.5 qui maintiennent la CI rouge sur `main` depuis ≥ PR #75. Une fois cette wave mergée, la CI sert de filet réel pour les blocs A et E qui suivent. ZÉRO logique métier cette wave — outillage CI pur.

---

## D1 — ESLint v10 flat config pour `@tap/database` et `@tap/shared`

**Symptôme** : `ESLint couldn't find an eslint.config.(js|mjs|cjs) file.` ESLint 10.x (résolu par le lockfile) a retiré le support de `.eslintrc.*`. `apps/web` passe (wrapper Next.js propre) ; les deux packages échouent.

**Fichiers à créer** :
- `packages/database/eslint.config.js` (NEW — flat config)
- `packages/shared/eslint.config.js` (NEW — flat config)

**Fichiers à supprimer** (s'ils existent) :
- `packages/database/.eslintrc.json` / `.eslintrc.*`
- `packages/shared/.eslintrc.json` / `.eslintrc.*`

**Action** : créer un `eslint.config.js` flat config minimal et cohérent par package — `export default` d'un tableau de configs, `@typescript-eslint` parser pour les `.ts`, `ignores` sur `dist/` et `coverage/`. Lire d'abord la config ESLint existante de `apps/web` (ou la racine) pour réutiliser le même socle de règles plutôt que d'inventer un jeu de règles divergent. Si une config flat partageable existe déjà à la racine, l'importer ; sinon, config locale minimale.

**Hypothèse à confirmer en execute** : la version d'ESLint réellement résolue (`pnpm why eslint`). Si downgrade explicite en 9.x est jugé plus sûr que la migration flat config, le documenter — mais la cible VISION.md = `eslint.config.js` flat config.

---

## D2 — SIRET de test Luhn-invalide dans `@tap/shared`

**Symptôme** : `packages/shared/src/validators/__tests__/common.test.ts` — `siretSchema.parse('40483304800010')` throw `SIRET invalide (échec contrôle Luhn)`. Le SIRET de référence du test ne passe pas le contrôle Luhn de `siretSchema`.

**Fichier à modifier** :
- `packages/shared/src/validators/__tests__/common.test.ts`

**Action** : remplacer `40483304800010` par un **SIRET fictif Luhn-valide**. Valeur recommandée : `12345678900007` (SIREN `123456789` + NIC `00007`, somme Luhn = 50, divisible par 10). Ne PAS utiliser de SIRET d'entreprise réelle (NFR-001 — pas de nom propre, et un SIRET fictif lisible est préférable). Vérifier que la valeur passe : le test `siretSchema.parse('12345678900007')` doit retourner la chaîne sans throw. Si la valeur recommandée échoue contre l'implémentation Luhn réelle de `siretSchema` (lire `packages/shared/src/validators/` pour la fonction de contrôle), calculer une autre valeur 14 chiffres satisfaisant cette implémentation précise.

**Read first** : `packages/shared/src/validators/__tests__/common.test.ts` + le fichier validators qui définit `siretSchema` (pour la fonction Luhn exacte).

---

## D3 — Runner pgTAP CI cassé

**Symptôme** : le job `Tests RLS pgTAP` échoue sur toutes les PR récentes, y compris docs-only (PR #75). Cause probable : drift de `supabase/setup-cli@v1 version: latest` — la dernière CLI Supabase a cassé `supabase db start` / `supabase test db`.

**Fichiers à modifier** :
- `.github/workflows/*.yml` — le workflow qui exécute les tests pgTAP (identifier le job, probablement dans `cd.yml` ou un workflow de tests dédié).

**Action** :
1. Identifier le workflow + job pgTAP (`grep -rln "pgTAP\|supabase test\|supabase/setup-cli" .github/workflows/`).
2. Diagnostic : lire les logs du dernier run rouge si accessibles ; sinon reproduire le scénario localement (`supabase db start` + `supabase test db`).
3. Fix attendu : **pinner** `supabase/setup-cli` à une version connue verte (ex. `version: 2.x.x` explicite au lieu de `latest`) — la cause racine la plus probable. Tester avec la version pinnée.
4. Si le pin ne suffit pas, creuser la cause (image Postgres, extension pgTAP, dépendance Docker compose) et corriger.

**Estimation D3** : 1-2 h (diagnostic inclus). C'est l'item le plus incertain de la wave.

---

## Critères GREEN

- CI : job Lint **vert** sur `@tap/database` et `@tap/shared` (`pnpm -C packages/database lint` et `pnpm -C packages/shared lint` passent).
- CI : test `siretSchema` **vert** — la suite `@tap/shared` passe intégralement.
- CI : job `Tests RLS pgTAP` **vert** (le runner s'exécute et les assertions passent).
- `pnpm typecheck` workspace inchangé (PASS).
- Aucune régression : `apps/web` lint toujours vert.

---

## Risques + mitigations

- **D3 imprévisible** : si le pin de version ne résout pas, le diagnostic peut déborder. Mitigation : time-box 2 h ; si non résolu, livrer D1+D2 et documenter D3 en CONCERNS avec l'état du diagnostic (la wave reste un progrès net). Ne PAS bloquer A et E sur D3.
- **Flat config divergente** : risque d'introduire un jeu de règles incohérent avec `apps/web`. Mitigation : réutiliser le socle existant, config minimale.
- **Lockfile** : si la résolution ESLint bouge, `pnpm-lock.yaml` change — commit cohérent.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Désactiver les jobs CI rouges au lieu de les corriger.
- ❌ Utiliser un SIRET d'entreprise réelle comme valeur de test (NFR-001 + clarté).
- ❌ `--no-verify` ou skip de hooks pour « passer » la CI.
- ❌ Élargir le scope au-delà de D1/D2/D3 (toute autre dette CI = PR séparée — VISION.md).
- ❌ Laisser `supabase/setup-cli@latest` non pinné (la cause racine du drift).
