---
phase: 01-referentiel-patients
plan: 1
subsystem: tests-scaffolds
tags: [tests, scaffolds, RED, pgTAP, deno, playwright, vitest, wave-0]
requires: []
provides:
  - tests/pgTAP/patients
  - tests/pgTAP/patient_constraint
  - tests/pgTAP/patient_operational_note
  - tests/deno/nir-edge-function
  - tests/playwright/patient-flow
  - tests/vitest/patient-extended
  - config/playwright
  - config/deno
affects:
  - supabase/tests/
  - supabase/functions/
  - apps/web/
  - packages/shared/
tech_stack_added: [Playwright, concurrently, Deno test, pgTAP]
patterns:
  - fixtures pgTAP multi-tenant Alpha/Bravo
  - login programmatique Supabase Auth pour E2E
  - webServer Playwright lance Next.js + Edge Function en parallèle
key_files_created:
  - supabase/tests/patients.sql
  - supabase/tests/patient_constraint.sql
  - supabase/tests/patient_operational_note.sql
  - supabase/functions/import_map.json
  - supabase/functions/deno.json
  - supabase/functions/nir/index.test.ts
  - apps/web/package.json
  - apps/web/playwright.config.ts
  - apps/web/e2e/helpers/auth.ts
  - apps/web/e2e/patient-flow.spec.ts
  - packages/shared/src/validators/__tests__/patient.test.ts
key_files_modified: []
decisions:
  - "Tests Phase 1 : 35 assertions pgTAP cumulées (20 + 8 + 7) couvrent PAT-01..PAT-07"
  - "webServer Playwright via concurrently lance Next.js + supabase functions serve nir simultanément (sinon E2E échoue à la création de patient)"
  - "Login E2E programmatique (POST /auth/v1/token + addCookies), pas de navigation UI"
  - "Cas Vitest 1-5 doivent passer immédiatement (schéma actuel), cas 6-10 sont RED jusqu'à Plan 2"
metrics:
  duration_minutes: ~5
  commits: 3
  task_count: 3
  file_count: 11
  completed_date: 2026-05-07
---

# Phase 01 Plan 1 : Scaffolds tests RED Phase 1 — Summary

Pose 11 fichiers de scaffolds en RED couvrant les 7 requirements PAT-* de la
Phase 1 (3 fichiers pgTAP, 3 fichiers Deno/config, 4 fichiers Playwright +
Vitest), garantissant qu'aucun executor des Waves 1-3 n'aura à inventer la
commande de vérification.

## What Was Built

### Couche pgTAP (3 fichiers, 35 assertions cumulées)

| Fichier | plan() | Couverture |
|---|---|---|
| `supabase/tests/patients.sql` | 20 | RLS forcée, schéma chiffrement NIR (`nir_encrypted bytea`, `nir_search_hash bytea`), colonne `search_text` generated stored, index GIN `pg_trgm`, unicité partielle par tenant, isolation Alpha/Bravo, DELETE interdit, audit_logs sans NIR, EXPLAIN Bitmap Index Scan |
| `supabase/tests/patient_constraint.sql` | 8 | RLS, INSERT régulateur OK / chauffeur 42501, isolation tenant, CASCADE depuis patients, audit insert + delete |
| `supabase/tests/patient_operational_note.sql` | 7 | RLS, historique en chaîne `replaced_by_id`, une seule note active par patient, CHECK 500 chars (23514), audit insert ×2 |

### Couche Edge Function Deno (3 fichiers)

| Fichier | Rôle |
|---|---|
| `supabase/functions/import_map.json` | Imports std + supabase-js |
| `supabase/functions/deno.json` | TS strict + tasks.test |
| `supabase/functions/nir/index.test.ts` | 6 cas Deno : round-trip encrypt/decrypt, IV unique (replay protection), hash déterministe + normalisation espaces, clés AES vs HMAC distinctes, handler 401 sans JWT, audit_logs `patient.nir.decrypt` sur déchiffrement |

### Couche apps/web Playwright (3 fichiers + 1 package.json)

| Fichier | Rôle |
|---|---|
| `apps/web/package.json` | DevDeps minimales : `@playwright/test`, `concurrently`, `typescript` |
| `apps/web/playwright.config.ts` | Projet chromium, locale fr-FR, timezone Indian/Reunion, webServer `concurrently` lance Next.js dev + `supabase functions serve nir` en parallèle, env vars NIR + SERVICE_ROLE propagées |
| `apps/web/e2e/helpers/auth.ts` | `loginAsRegulateur(page, email, password)` — POST direct `/auth/v1/token?grant_type=password`, set cookies `sb-access-token` / `sb-refresh-token`. `clearAuth(page)` pour tester redirect /login |
| `apps/web/e2e/patient-flow.spec.ts` | Scénario unique exhaustif : login → /patients/new → fill formulaire → submit → URL [uuid] → /patients → fuzzy 1 char ne déclenche rien, 2 chars trouve "Hoarau Patrick" → drawer ouverture, `boundingBox().width === 400`, NIR masqué `/1•••••••••\d{2}\s*\d{2}/` → /patients/[id]/edit → canal SMS + consentement_sms.check() → enregistrer → fetch service_role audit_logs `action=eq.patient.update`, assert pas de `nir_encrypted` dans `metadata.new` |

### Couche Vitest (1 fichier)

| Fichier | Cas |
|---|---|
| `packages/shared/src/validators/__tests__/patient.test.ts` | 10 cas : 1-5 verts immédiatement (schéma actuel), 6-10 RED — `consentement_sms_at` requis si `consentement_sms=true`, `genreSchema` ('M'\|'F'\|'X'), `contactUrgenceSchema` (téléphone 974 obligatoire), `normalizeNir` (suppression espaces) |

## Key Decisions

1. **35 assertions pgTAP cumulées** dépassent largement la barre minimale (Wave 1 disposera d'un harness exhaustif pour la migration 003).
2. **webServer Playwright = concurrently Next.js + Edge Function NIR** — sans ça, le test E2E échoue à la création (NIR injoignable). Décision documentée dans le Revision Log itération 1/3 du PLAN.
3. **Login E2E programmatique** : POST `/auth/v1/token` + `addCookies()`, pas de fillForm — élimine le risque "E2E lent" identifié dans RESEARCH.md.
4. **Cas Vitest 6-10 RED via dynamic `import()`** : les exports attendus (`genreSchema`, `contactUrgenceSchema`, `normalizeNir`) seront ajoutés en Plan 2. L'absence d'export fait jeter une erreur explicite (RED clair, pas un faux positif).

## Baseline RED capturée (gate Wave 1)

| Layer | Commande | Échec attendu Wave 0 |
|---|---|---|
| pgTAP | `pnpm db:reset && pnpm db:test` | `relation "public.patients" does not exist` |
| Deno  | `cd supabase/functions && deno test --allow-env --allow-net --allow-read nir/index.test.ts` | `Module not found "./index.ts"` |
| Vitest | `pnpm -C packages/shared test patient` | 5 verts + 5 rouges (cas 6-10) |
| Playwright | `pnpm -C apps/web exec playwright test --list` | Liste le scénario même si Next.js absent |

Wave 1 (Plan 2) doit faire passer pgTAP + Deno + cas Vitest 6-10 au vert.
Wave 3 (Plans 4-5) fera passer Playwright au vert.

## Deviations from Plan

Aucune. Plan exécuté à l'identique.

Note mineure : la `command` du `webServer` dans `playwright.config.ts` a été
écrite sur une seule ligne (au lieu d'une concaténation multi-lignes) pour
satisfaire l'acceptance criterion `grep -E "concurrently.*supabase functions
serve nir"` qui requiert le pattern sur une ligne unique.

## Threat Flags

Aucun. Les scaffolds n'introduisent aucune surface de menace au-delà du
threat model déjà documenté dans le PLAN (T-01-01 à T-01-04, tous mitigés).

## Verification Commands (pour orchestrator + Wave 1 gate)

```bash
# pgTAP RED
pnpm db:reset 2>&1 | tail -5
pnpm db:test 2>&1 | grep -E "(patients|patient_constraint|patient_operational_note)"

# Deno RED
cd /home/user/TAP/supabase/functions && \
  deno test --allow-env --allow-net --allow-read nir/index.test.ts 2>&1 | tail -10

# Vitest mixte (5 verts + 5 RED)
cd /home/user/TAP && pnpm -C packages/shared test 2>&1 | tail -15

# Playwright list (config seule, app absente)
cd /home/user/TAP/apps/web && pnpm exec playwright test --list 2>&1 | head -10
```

## Commits

| Hash | Message |
|---|---|
| `4194f14` | `test(01-1): scaffold pgTAP tests pour patients, contraintes, notes` |
| `1d6800c` | `test(01-1): scaffold Deno test pour Edge Function NIR` |
| `f5440f8` | `test(01-1): scaffold Playwright config + E2E patient + tests Vitest étendus` |

## Self-Check: PASSED

Files exist :
- `supabase/tests/patients.sql` — FOUND
- `supabase/tests/patient_constraint.sql` — FOUND
- `supabase/tests/patient_operational_note.sql` — FOUND
- `supabase/functions/import_map.json` — FOUND
- `supabase/functions/deno.json` — FOUND
- `supabase/functions/nir/index.test.ts` — FOUND
- `apps/web/package.json` — FOUND
- `apps/web/playwright.config.ts` — FOUND
- `apps/web/e2e/helpers/auth.ts` — FOUND
- `apps/web/e2e/patient-flow.spec.ts` — FOUND
- `packages/shared/src/validators/__tests__/patient.test.ts` — FOUND

Commits exist :
- `4194f14` — FOUND
- `1d6800c` — FOUND
- `f5440f8` — FOUND
