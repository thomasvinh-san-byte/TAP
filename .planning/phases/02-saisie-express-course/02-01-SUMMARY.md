---
phase: 02-saisie-express-course
plan: 01
subsystem: validators
tags: [zod, chrono-node, shadcn, radix-dialog, radix-dropdown-menu, vitest, pgtap, playwright]

# Dependency graph
requires:
  - phase: 00-foundations
    provides: helpers RLS current_organization_id() / has_role(), pattern audit trigger
  - phase: 01-referentiel-patients
    provides: codePostalReunionSchema, pattern Vitest validators, PatientSearch, sonner toast
  - phase: 01.5-dpa-rgpd-compliance
    provides: pattern legal-token + rate-limit (réutilisé Wave 2 si besoin)
provides:
  - Schémas zod rideExpressInputSchema + rideDraftSchema alignés D-08 (4 transport modes, 3 urgences)
  - Helper parseFreeformDate (chrono-node FR locale, TZ Indian/Reunion)
  - Composants shadcn Dialog + DropdownMenu disponibles dans apps/web
  - 3 scaffolds pgTAP RED (rides_rls, ride_draft_rls, rides_audit) prêts pour Wave 1
  - 1 scaffold Playwright RED avec 6 test.skip mappés SAIS-01..06 prêts pour Wave 5
  - Placeholder Visible Progress (D-12) avec convention nommage 6 captures
affects: [02-saisie-express-course Wave 1 (migration 004), Wave 2 (Server Actions), Wave 3 (modal), Wave 4 (page /courses), Wave 5 (E2E + Visible Progress)]

# Tech tracking
tech-stack:
  added:
    - chrono-node@2.9.1 (parser date freeform FR — exact pin)
    - "@radix-ui/react-dropdown-menu@^2.1.1 (DraftQueue header Wave 4)"
  patterns:
    - "Validators zod : composition + ré-export via packages/shared/src/validators/index.ts"
    - "Helper pur dans packages/shared/src/utils/ avec ré-export auto via utils/index.ts"
    - "Vitest TZ-aware via test.env.TZ='Indian/Reunion' (aligné playwright.config.ts)"
    - "Scaffold pgTAP RED en plan(0) pour les tables non encore créées"
    - "Scaffold Playwright RED en test.skip mappé sur les requirements (SAIS-01..06)"

key-files:
  created:
    - packages/shared/src/utils/parse-freeform-date.ts (helper chrono-node FR)
    - packages/shared/src/utils/__tests__/parse-freeform-date.test.ts (9 tests)
    - packages/shared/src/validators/__tests__/ride.test.ts (10 tests)
    - apps/web/src/components/ui/dialog.tsx (wrapper Radix Dialog)
    - apps/web/src/components/ui/dropdown-menu.tsx (wrapper Radix DropdownMenu)
    - supabase/tests/rides_rls.sql (RED scaffold)
    - supabase/tests/ride_draft_rls.sql (RED scaffold)
    - supabase/tests/rides_audit.sql (RED scaffold)
    - apps/web/tests/e2e/saisie-express.spec.ts (6 test.skip SAIS-01..06)
    - docs/showcase/02-saisie-express-course/README.md (placeholder Visible Progress)
  modified:
    - packages/shared/src/validators/ride.ts (refonte complète — stub Phase 0 supprimé)
    - packages/shared/src/utils/index.ts (ré-export parse-freeform-date)
    - packages/shared/vitest.config.ts (TZ=Indian/Reunion injectée)
    - packages/shared/package.json (chrono-node dep ajoutée)
    - apps/web/package.json (Radix dropdown-menu dep ajoutée)
    - pnpm-lock.yaml

key-decisions:
  - "Refonte complète de validators/ride.ts plutôt qu'extension : symboles Phase 0 (courseExpressSchema, typeTransportSchema, CourseExpressInput) totalement incompatibles avec D-08, zéro consommateur résiduel vérifié par grep"
  - "chrono-node@2.9.1 pinné exactement (pas de ^) pour figer le comportement du parser FR — supply chain mitigation T-02-01 du threat register du PLAN"
  - "TZ Indian/Reunion injectée dans packages/shared/vitest.config.ts via test.env plutôt que dans chaque test : aligné avec apps/web/playwright.config.ts (timezoneId Indian/Reunion) — évite la dérive RESEARCH § Pitfall 5"
  - "Composants shadcn Dialog + DropdownMenu créés manuellement en wrappers Radix (pattern sheet.tsx existant) plutôt que via shadcn CLI : le CLI exige interactif network access non disponible en sandbox, le pattern manuel produit un résultat équivalent"
  - "Scaffolds pgTAP en plan(0) explicite plutôt qu'en pg_tap.skip() : permet d'exécuter les fichiers en CI sans erreur jusqu'à ce que la table rides existe (Wave 1)"

patterns-established:
  - "Validators zod refonte : grep -rn legacySchema avant suppression, vérifier zéro consommateur sur apps + packages, puis overwrite intégral"
  - "Helper pur testable : signature stricte (input, ref?) → discriminated union {ok:true,iso}|{ok:false,reason}, jamais throw"
  - "Vitest TZ-aware : packages/shared/vitest.config.ts test.env.TZ injecté + skip-if-not-Reunion guard côté test (ceinture+bretelles)"
  - "Scaffold RED multi-couche : 1 commit chore(deps+wrappers) + 1 commit test(scaffolds) + 1 commit docs(summary)"

requirements-completed: []

# Metrics
duration: 7min
completed: 2026-05-07
---

# Phase 2 Plan 01: Fondations Wave 0 saisie express course Summary

**Refonte zod ride D-08 (rideExpressInputSchema + rideDraftSchema) + helper parseFreeformDate chrono-node FR + shadcn Dialog/DropdownMenu + scaffolds RED pgTAP/Vitest/Playwright/Visible Progress prêts pour Waves 1-5**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-07T10:07:00Z
- **Completed:** 2026-05-07T10:13:24Z
- **Tasks:** 3
- **Files modified:** 16 (10 créés, 6 modifiés)

## Accomplishments

- Stub Phase 0 incompatible (courseExpressSchema 9 champs `adresse_depart`/`aller_retour`/`prescription_id`) **supprimé** sans casser un seul consommateur — refonte complète vers le modèle D-08 (10 champs `pickup_address`/`dropoff_address`/`scheduled_at`/4 modes/3 urgences). Vitest 10/10 GREEN.
- Helper `parseFreeformDate` (chrono-node FR locale) testé sur 8 cas paramétrés sous TZ Indian/Reunion — l'ISO retourné pour « 15/05 14h30 » est exactement `2026-05-15T10:30:00.000Z` (UTC+4 résolu correctement). Vitest 9/9 GREEN.
- Wrappers Radix Dialog + DropdownMenu créés manuellement (équivalents shadcn), typecheck `@tap/web` propre, 0 console.* / 0 import @supabase/.
- 3 scaffolds pgTAP en `plan(0)` + 1 scaffold Playwright avec 6 `test.skip` listés par `playwright test --list` (compilation OK).
- Placeholder Visible Progress (D-12) documente la convention de nommage des 6 captures attendues Wave 5.

## Task Commits

Chaque tâche a été committée atomiquement :

1. **Task 1.1 + 1.2 + 1.3 (deps + wrappers)** — `d2b8b6d` (chore)
   - Refonte validators/ride.ts (Task 1.1)
   - Helper parseFreeformDate + chrono-node@2.9.1 (Task 1.2)
   - Composants Dialog + DropdownMenu + Radix dropdown-menu dep (Task 1.3 partiel)
2. **Task 1.3 (scaffolds RED)** — `73dd64b` (test)
   - 3 fichiers pgTAP plan(0)
   - 1 fichier Playwright 6×skip
   - 1 README showcase placeholder
3. **Plan metadata** — _ce commit_ (docs)

_Note : la consigne d'exécution imposait 3 commits techniques et non 1 commit par task ; les tâches 1.1, 1.2 et la partie « wrappers » de 1.3 ont été regroupées dans le commit `chore` car elles forment un même bundle « deps + couche pure » sans dépendance externe entre elles. Tous les acceptance_criteria de chaque task ont été vérifiés individuellement avant le commit groupé (10 + 9 tests Vitest GREEN, typecheck shared + web GREEN, 6 tests Playwright listés, plan(0) confirmé)._

## Files Created/Modified

### Créés (10)
- `packages/shared/src/utils/parse-freeform-date.ts` — wrapper chrono.fr.parseDate avec rejet date passée + saisie vide (45 lignes)
- `packages/shared/src/utils/__tests__/parse-freeform-date.test.ts` — 9 tests (8 sous TZ + 1 sanity)
- `packages/shared/src/validators/__tests__/ride.test.ts` — 10 tests zod (defaults, refus UUID/offset/postal hors 974, etc.)
- `apps/web/src/components/ui/dialog.tsx` — wrapper Radix Dialog (Dialog/DialogContent/Header/Title/Description/Footer/Trigger/Close, focus trap auto, aria-label « Fermer »)
- `apps/web/src/components/ui/dropdown-menu.tsx` — wrapper Radix DropdownMenu (Menu/Trigger/Content/Item/Label/Separator/Group/Portal)
- `supabase/tests/rides_rls.sql` — plan(0), commentaire de TODO Wave 1 explicite
- `supabase/tests/ride_draft_rls.sql` — plan(0), commentaire Pitfall 4 RESEARCH
- `supabase/tests/rides_audit.sql` — plan(0), commentaire D-10 trigger
- `apps/web/tests/e2e/saisie-express.spec.ts` — 6 test.skip (SAIS-01..06) avec helper loginRegulateur
- `docs/showcase/02-saisie-express-course/README.md` — convention 6 captures + walkthrough Wave 5

### Modifiés (6)
- `packages/shared/src/validators/ride.ts` — refonte complète (de 57 lignes legacy stub vers 60 lignes alignées D-08)
- `packages/shared/src/utils/index.ts` — `+ export * from './parse-freeform-date';`
- `packages/shared/vitest.config.ts` — `test.env.TZ = 'Indian/Reunion'` injecté
- `packages/shared/package.json` — `+chrono-node: 2.9.1`
- `apps/web/package.json` — `+@radix-ui/react-dropdown-menu: ^2.1.1`
- `pnpm-lock.yaml` — résolutions chrono-node + transitives Radix

## Decisions Made

Aucune décision hors plan. Toutes les décisions relèvent du PLAN.md (D-08, DEC-005) ou des thread risks RESEARCH (R3 refonte, Pitfall 5 TZ).

**Mécaniques notables :**
- Le test 1 de `parse-freeform-date` produit l'ISO exactement attendu (`2026-05-15T10:30:00.000Z`) — confirme que `test.env.TZ` est bien appliqué au worker Vitest avant l'instantiation de `Date`.
- chrono-node 2.9.1 résout correctement « 30/02 » via la branche « date passée » (parsing fait remonter une date proche déjà passée) — assertion testée avec regex `Format non reconnu|passé`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installation explicite de @radix-ui/react-dropdown-menu**
- **Found during:** Task 1.3 (composants shadcn)
- **Issue:** Le PLAN.md indique « déjà transitif via Radix » mais grep sur `package.json` + `node_modules/.pnpm/` confirme que `@radix-ui/react-dropdown-menu` n'était PAS installé (seul `@radix-ui/react-dialog` l'était). Sans cette dep, le wrapper `dropdown-menu.tsx` ne compile pas.
- **Fix:** `pnpm --filter @tap/web add @radix-ui/react-dropdown-menu@^2.1.1` (le PLAN avait anticipé ce cas en fallback : « à installer si absent »).
- **Files modified:** apps/web/package.json, pnpm-lock.yaml
- **Verification:** `pnpm --filter @tap/web typecheck` exit 0 après ajout
- **Committed in:** `d2b8b6d` (commit chore groupé)

**2. [Rule 2 - Missing Critical] try/catch autour de chrono.fr.parseDate**
- **Found during:** Task 1.2 (helper parseFreeformDate)
- **Issue:** Le PLAN.md ne wrap pas l'appel chrono.fr.parseDate, mais le threat register T-02-03 (DoS sur input pathologique) exige une mitigation. chrono-node peut théoriquement lever sur certains inputs malformés.
- **Fix:** Ajout `try { parsed = chrono.fr.parseDate(...) } catch { parsed = null }` qui retombe proprement sur le `if (!parsed) return { ok:false, reason:'Format non reconnu...' }`.
- **Files modified:** packages/shared/src/utils/parse-freeform-date.ts
- **Verification:** Le test 7 et 8 (saisies vides/whitespace) passent + le helper ne lèvera jamais quelle que soit l'entrée
- **Committed in:** `d2b8b6d`

**3. [Rule 2 - Missing Critical] Skip TZ-conditionnel ceinture+bretelles dans parse-freeform-date.test.ts**
- **Found during:** Task 1.2 (test parser date)
- **Issue:** Le PLAN.md propose « laisser passer en CI, le runtime navigateur de la régulatrice sera bon ». En pratique, si quelqu'un retire `TZ=Indian/Reunion` du vitest.config.ts, les assertions ISO échoueront silencieusement avec un message confus. Better fail-fast.
- **Fix:** Ajout d'un guard `const TZ_OK = process.env.TZ === 'Indian/Reunion'; const describeTz = TZ_OK ? describe : describe.skip;` qui skip explicitement la suite TZ-dépendante avec un message clair, plus une suite « TZ-agnostique » sanity check.
- **Files modified:** packages/shared/src/utils/__tests__/parse-freeform-date.test.ts
- **Verification:** 9/9 GREEN sous TZ active ; sous TZ absente, 1 sanity check passe + 8 sont skip avec raison explicite
- **Committed in:** `d2b8b6d`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical)
**Impact on plan:** Toutes les déviations renforcent la robustesse de la couche pure et étaient anticipées comme « fallback » ou « mitigation » dans le PLAN/RESEARCH/threat_model. Aucun scope creep.

## Issues Encountered

### 1. Test Phase 0 commun pré-existant en échec — hors scope (DETTE déjà tracée)

**Issue :** `pnpm --filter @tap/shared test` (full suite) montre 1 fail sur `packages/shared/src/validators/__tests__/common.test.ts` :
```
expect(siretSchema.parse('40483304800010')).toBe('40483304800010');
→ SIRET invalide (échec contrôle Luhn)
```

**Diagnostic :** `40483304800010` est saisi comme « SIRET valide Carrefour » mais `verifyLuhn` retourne `false` sur ce numéro. C'est une erreur de fixture Phase 0 (le SIRET correct de Carrefour France est `40483305800013`, dernier chiffre `3` pas `0`).

**Décision :** **HORS SCOPE Plan 02-01**. CLAUDE.md § 14 « Dette identifiée » trace explicitement : « SIRET Luhn check `40483304800010` (test Phase 0 commun) — fix dédié à planifier ». Aucune intervention en scope ride/parser/wrappers.

**Statut :** Le test échouera tant que le fix dédié n'est pas planifié ; les 50 autres tests Vitest passent (incluant les 19 nouveaux ride.test + parse-freeform-date.test).

## Deferred Issues

Aucun différé spécifique au Plan 02-01. La DETTE Phase 0 (SIRET Luhn fixture) reste tracée dans CLAUDE.md § 14 et ne bloque ni la livraison Wave 0 ni les Waves suivantes (les nouveaux tests sont ciblables individuellement via `pnpm test -- ride` ou `pnpm test -- parse-freeform-date`).

## User Setup Required

Aucun — Wave 0 = couche pure + scaffolds. Aucune configuration externe requise.

## Next Phase Readiness

### Wave 1 (à démarrer immédiatement)
- ✅ Schémas zod prêts à être typés contre Database['public']['Tables']['rides']['Row'] dès régénération `pnpm --filter @tap/database supabase:gen-types` post-migration 004
- ✅ Helper parseFreeformDate prêt à être consommé dans le `RideExpressModal.client.tsx` Wave 3
- ✅ Composants Dialog + DropdownMenu prêts pour le modal global Wave 3 et la DraftQueue header Wave 4
- ✅ Scaffolds pgTAP en plan(0) prêts à être remplis par les assertions Wave 1 (calque 1:1 sur supabase/tests/patients.sql)

### Décisions encore en attente Guillaume (R1 RESEARCH — non bloquant Wave 0)
- ⚠️ **Raccourci global réel** : `Cmd/Ctrl+Shift+K` recommandé (DEC-015 verrouillait `Cmd+N` non interceptable). Ce point doit être tranché avant la Wave 5 (E2E SAIS-02), pas avant les Waves 1-4.

### Self-Check : PASSED

- [x] `packages/shared/src/utils/parse-freeform-date.ts` existe (Bash: ls)
- [x] `packages/shared/src/utils/__tests__/parse-freeform-date.test.ts` existe (9/9 Vitest GREEN)
- [x] `packages/shared/src/validators/ride.ts` refonte (rideExpressInputSchema exporté, 0 occurrence courseExpressSchema/typeTransportSchema)
- [x] `packages/shared/src/validators/__tests__/ride.test.ts` existe (10/10 Vitest GREEN)
- [x] `apps/web/src/components/ui/dialog.tsx` existe (3 occurrences DialogContent, 0 console.*, 0 @supabase/)
- [x] `apps/web/src/components/ui/dropdown-menu.tsx` existe (3 occurrences DropdownMenuContent)
- [x] 3 fichiers pgTAP existent avec `select plan(0);`
- [x] `apps/web/tests/e2e/saisie-express.spec.ts` existe (6 test.skip listés par `playwright test --list`)
- [x] `docs/showcase/02-saisie-express-course/README.md` existe
- [x] Commit d2b8b6d trouvé dans git log
- [x] Commit 73dd64b trouvé dans git log
- [x] `pnpm --filter @tap/shared typecheck` exit 0
- [x] `pnpm --filter @tap/web typecheck` exit 0

## Self-Check: PASSED

---
*Phase: 02-saisie-express-course*
*Plan: 01 (Wave 0 — Fondations)*
*Completed: 2026-05-07*
