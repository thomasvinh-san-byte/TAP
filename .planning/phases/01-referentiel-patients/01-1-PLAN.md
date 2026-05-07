---
phase: 01-referentiel-patients
plan: 1
type: execute
wave: 0
depends_on: []
files_modified:
  - supabase/tests/patients.sql
  - supabase/tests/patient_constraint.sql
  - supabase/tests/patient_operational_note.sql
  - supabase/functions/nir/index.test.ts
  - supabase/functions/import_map.json
  - supabase/functions/deno.json
  - apps/web/playwright.config.ts
  - apps/web/e2e/helpers/auth.ts
  - apps/web/e2e/patient-flow.spec.ts
  - apps/web/package.json
  - packages/shared/src/validators/__tests__/patient.test.ts
autonomous: true
requirements:
  - PAT-01
  - PAT-02
  - PAT-03
  - PAT-04
  - PAT-05
  - PAT-06
  - PAT-07
must_haves:
  truths:
    - "Tous les fichiers de tests Phase 1 existent en RED (échouent volontairement) avant toute implémentation"
    - "pnpm db:test invoque les 3 fichiers pgTAP nouveaux et échoue avec un message clair (table patients absente)"
    - "deno test sur supabase/functions/nir/index.test.ts échoue avec module non trouvé (avant implémentation Wave 1)"
    - "pnpm -C apps/web exec playwright test --list affiche le scénario patient-flow.spec.ts (config valide même si app absente)"
  artifacts:
    - path: supabase/tests/patients.sql
      provides: "Fixtures 2 tenants + plan() + assertions RLS, audit, unicité NIR, EXPLAIN GIN"
      min_lines: 80
    - path: supabase/tests/patient_constraint.sql
      provides: "Plan pgTAP RLS + cascade delete depuis patients"
      min_lines: 40
    - path: supabase/tests/patient_operational_note.sql
      provides: "Plan pgTAP historique en chaîne (replaced_by_id)"
      min_lines: 40
    - path: supabase/functions/nir/index.test.ts
      provides: "Tests Deno round-trip + hash déterministe + IV unique + JWT 401"
      min_lines: 60
    - path: apps/web/playwright.config.ts
      provides: "Config Playwright minimale chromium"
      min_lines: 20
    - path: apps/web/e2e/helpers/auth.ts
      provides: "Helper loginAsRegulateur programmatique (pas via UI)"
      min_lines: 25
    - path: apps/web/e2e/patient-flow.spec.ts
      provides: "Test E2E flow complet : create → search → drawer → edit → audit_log"
      min_lines: 50
  key_links:
    - from: supabase/tests/patients.sql
      to: public.patients
      via: pgTAP plan() + assertions on relrowsecurity
      pattern: "relrowsecurity.*patients"
    - from: supabase/functions/nir/index.test.ts
      to: supabase/functions/nir/index.ts
      via: Deno import
      pattern: "from.*\\./index"
    - from: apps/web/e2e/patient-flow.spec.ts
      to: loginAsRegulateur
      via: import helper
      pattern: "loginAsRegulateur"
---

<objective>
Poser les scaffolds de tests RED pour toute la Phase 1 AVANT implémentation. Aucun code applicatif n'est créé ici. Ce plan garantit que chaque tâche des waves 1-3 a un test automatisé qui échoue d'abord, conformément au Nyquist Rule (chaque verify a un automated, pas de "MISSING").

Purpose: établir la barre de complétion mesurable de la phase (les 3 fichiers pgTAP, le test Deno, la config Playwright + scénario E2E) pour qu'aucun executor des waves suivantes n'ait à inventer la commande de vérification.

Output: 7 fichiers de tests en RED + 2 fichiers de config Deno/Playwright + 1 helper d'auth E2E.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-referentiel-patients/01-CONTEXT.md
@.planning/phases/01-referentiel-patients/01-RESEARCH.md
@.planning/phases/01-referentiel-patients/01-PATTERNS.md
@CLAUDE.md
@supabase/tests/foundations.sql
@packages/shared/src/validators/__tests__/common.test.ts

<interfaces>
<!-- Helpers RLS pgTAP déjà disponibles depuis migration 001/002 -->
public.current_organization_id() returns uuid
public.current_user_role() returns public.user_role
public.has_role(public.user_role) returns boolean

<!-- Pattern fixtures multi-tenant pgTAP, source : supabase/tests/foundations.sql lignes 45-73 -->
-- Org Alpha : 11111111-1111-1111-1111-111111111111
-- Org Bravo : 22222222-2222-2222-2222-222222222222
-- User alpha-dir : aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa (dirigeant)
-- User alpha-reg : à créer ici (régulateur)
-- User bravo-reg : à créer ici (régulateur)

<!-- Pattern simulation rôle authentifié -->
set local role authenticated;
set local "request.jwt.claim.sub" = '<user_uuid>';
-- ... assertions ...
reset role;
reset "request.jwt.claim.sub";

<!-- Validators existants à étendre -->
// packages/shared/src/validators/patient.ts
export const patientSchema: ZodObject<{
  prenom, nom, date_naissance, telephone?, nir?, adresse,
  canal_contact_prefere, consentement_sms, notes_operationnelles?
}>
export type PatientInput = z.infer<typeof patientSchema>
export const canalContactSchema: ZodEnum<['sms','appel','aucun']>
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Tâche 1 : Scaffolds pgTAP en RED pour patients + patient_constraint + patient_operational_note</name>
  <files>supabase/tests/patients.sql, supabase/tests/patient_constraint.sql, supabase/tests/patient_operational_note.sql</files>
  <read_first>
    - /home/user/TAP/supabase/tests/foundations.sql (intégral — pattern transaction begin/plan/finish, fixtures 2 tenants, set local role, throws_ok)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 171-256, section pgTAP)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 187-232, schéma migration 003 attendu)
  </read_first>
  <action>
Créer 3 fichiers pgTAP qui échouent volontairement (table patients absente en wave 0).

**supabase/tests/patients.sql** (assertions, ne pas implémenter le squelette de la migration ici — les assertions DOIVENT échouer tant que la wave 1 n'a pas tourné) :
- `begin;` puis `select plan(20);`
- Fixtures 2 tenants (orgs Alpha + Bravo) + 3 users (alpha-dir, alpha-reg, bravo-reg) — **dupliquer le pattern lignes 45-73 de foundations.sql** ; réutiliser les UUIDs Alpha + ajouter UUIDs alpha-reg `cccccccc-cccc-cccc-cccc-cccccccccccc` et bravo-reg `dddddddd-dddd-dddd-dddd-dddddddddddd`. Insérer les profils correspondants.
- 20 assertions, dans cet ordre exact :
  1. `relrowsecurity` = true sur public.patients
  2. `relforcerowsecurity` = true sur public.patients
  3. Type énuméré `patient_constraint_type` existe avec 8 valeurs (`select array_length(enum_range(null::public.patient_constraint_type), 1) = 8`)
  4. Colonne `nir_encrypted bytea` existe
  5. Colonne `nir_search_hash bytea` existe
  6. Colonne `search_text` est `generated always as ... stored` (interroger `pg_attribute.attgenerated = 's'`)
  7. Index `patients_search_trgm_idx` existe et est de type GIN (`pg_index` join `pg_class` join `pg_am`)
  8. Index unique partiel `patients_nir_unique` existe avec prédicat `archive = false and nir_search_hash is not null`
  9. Sous identité alpha-reg : INSERT patient minimal valide réussit
  10. Sous identité alpha-reg : SELECT du patient inséré retourne 1 ligne
  11. Sous identité bravo-reg : SELECT du patient Alpha retourne 0 ligne (isolation tenant)
  12. Sous identité bravo-reg : INSERT avec `organization_id = orgAlpha` lève `42501` (RLS WITH CHECK)
  13. Sous identité alpha-reg : DELETE lève `42501` (DELETE non autorisé, archivage logique)
  14. Sous identité alpha-reg : UPDATE archive=true réussit
  15. Audit_logs reçoit une ligne `action='patient.insert'` après l'INSERT
  16. `audit_logs.metadata->'new'` ne contient PAS la clé `nir_encrypted` (`select (metadata->'new') ? 'nir_encrypted' = false`)
  17. `audit_logs.metadata->'new'` ne contient PAS la clé `nir_search_hash`
  18. INSERT 2e patient avec même `nir_search_hash` dans org Alpha → conflit unique (`throws_ok` SQLSTATE `23505`)
  19. INSERT 2e patient avec même `nir_search_hash` dans org Bravo → réussit (multi-tenant)
  20. EXPLAIN sur `select * from public.patients where search_text % 'ho'` contient `Bitmap Index Scan on patients_search_trgm_idx` (utiliser `query_to_xml` ou wrapper SQL function pour capturer le plan ; cf. pattern Pitfall 3 RESEARCH.md)
- `select * from finish();` puis `rollback;`

**supabase/tests/patient_constraint.sql** (`select plan(8)`) :
- Réutilise les mêmes fixtures (encapsulées dans `begin/rollback`)
- Crée un patient parent en alpha
- 8 assertions :
  1. RLS activée + 2. RLS forcée
  3. Sous alpha-reg : INSERT patient_constraint type='vehicule_tpmr' réussit
  4. Sous bravo-reg : SELECT contraint cross-tenant = 0 ligne
  5. DELETE du patient parent déclenche CASCADE sur patient_constraint (assertion `select count(*) from public.patient_constraint where patient_id = '...'` = 0 après archivage logique → ce point est testé via un INSERT puis suppression directe en service_role pour valider la FK ; ne PAS utiliser DELETE depuis alpha-reg car interdit par RLS)
  6. Sous chauffeur (créer un user chauffeur Alpha) : INSERT patient_constraint lève `42501` (seul régulateur ou dirigeant peut INSERT)
  7. Audit_logs reçoit `patient_constraint.insert` après l'INSERT
  8. Audit_logs reçoit `patient_constraint.delete` après le DELETE

**supabase/tests/patient_operational_note.sql** (`select plan(7)`) :
- Fixtures équivalentes
- 7 assertions :
  1. RLS activée + 2. RLS forcée
  3. INSERT note 1 sous alpha-reg → réussit
  4. INSERT note 2 sous alpha-reg + UPDATE note1.replaced_by_id = note2.id → réussit
  5. `select count(*) from patient_operational_note where patient_id = $1 and replaced_by_id is null` = 1 (une seule note active)
  6. CHECK contrainte longueur 500 chars : INSERT note de 501 chars lève `23514`
  7. Audit_logs reçoit `patient_operational_note.insert` après chaque INSERT

**Critique :** ces 3 fichiers DOIVENT échouer en wave 0 (table patients/patient_constraint/patient_operational_note absente). Ne jamais créer de stubs SQL pour les faire passer artificiellement.

Convention :
- En-tête `-- =============================` style migrations 001/002
- Fichier ≤ 300 lignes (CLAUDE.md §11)
- Messages d'assertion en français
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm db:reset 2&gt;&amp;1 | tail -5; pnpm db:test 2&gt;&amp;1 | grep -E "(patients|patient_constraint|patient_operational_note)" | head -10 &amp;&amp; echo "RED expected: tests doivent ÉCHOUER (relation does not exist) car migration 003 pas encore appliquée"</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l supabase/tests/patients.sql` ≥ 80 lignes
    - `wc -l supabase/tests/patient_constraint.sql` ≥ 40 lignes
    - `wc -l supabase/tests/patient_operational_note.sql` ≥ 40 lignes
    - `grep -c "select plan(" supabase/tests/patients.sql` == 1
    - `grep -c "rollback" supabase/tests/patients.sql` == 1
    - `grep -c "11111111-1111-1111-1111-111111111111" supabase/tests/patients.sql` ≥ 1 (réutilisation org Alpha)
    - `grep -c "patient.insert" supabase/tests/patients.sql` ≥ 1 (assertion audit)
    - `grep -c "Bitmap Index Scan" supabase/tests/patients.sql` ≥ 1 (assertion EXPLAIN)
    - `grep -c "force row level security\\|relforcerowsecurity" supabase/tests/patients.sql` ≥ 1
    - `pnpm db:test 2>&1 | grep -c "ERROR\\|FAIL\\|relation .* does not exist"` ≥ 1 (RED attendu)
  </acceptance_criteria>
  <done>3 fichiers pgTAP existent, échouent en RED avec message "relation does not exist", aucune assertion ne triche.</done>
</task>

<task type="auto">
  <name>Tâche 2 : Scaffold Deno test Edge Function NIR + config import_map + deno.json</name>
  <files>supabase/functions/nir/index.test.ts, supabase/functions/import_map.json, supabase/functions/deno.json</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 99-137, 348-378, 514-535 — squelette Edge Function + tests Deno)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 261-309, section Edge Function)
    - /home/user/TAP/CLAUDE.md (§ 6 sécurité — pas de NIR clair en log, jamais)
  </read_first>
  <action>
Créer le scaffold Deno qui échouera avant l'implémentation wave 1.

**supabase/functions/import_map.json** :
```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

**supabase/functions/deno.json** :
```json
{
  "imports": {
    "std/": "https://deno.land/std@0.224.0/",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  },
  "compilerOptions": {
    "strict": true,
    "lib": ["deno.window", "esnext"]
  },
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read"
  }
}
```

**supabase/functions/nir/index.test.ts** (tests Deno qui DOIVENT échouer car index.ts n'existe pas encore) :
- Imports : `import { assertEquals, assertNotEquals, assertRejects } from "std/assert/mod.ts";`
- Import du module à tester : `import { encryptNir, decryptNir, hashNir, handler } from "./index.ts";` — ce import EST l'échec attendu en wave 0
- Setup : variables d'env factices via `Deno.env.set("APP_NIR_ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")` (32 bytes base64) et `APP_NIR_SEARCH_KEY` distincte
- 6 cas de test :
  1. `Deno.test("round-trip encrypt → decrypt = identité", ...)` : `decryptNir(await encryptNir("1801234567823")) === "1801234567823"`
  2. `Deno.test("IV unique : deux encrypts du même NIR donnent ciphertexts différents")` : `assertNotEquals(await encryptNir(nir), await encryptNir(nir))` (preuve replay protection)
  3. `Deno.test("hash déterministe : même NIR normalisé = même hash")` : `assertEquals(await hashNir("1 80 12 34 567 823"), await hashNir("1801234567823"))` (test normalisation espaces)
  4. `Deno.test("hash distinct entre clé chiffrement et clé HMAC")` : encrypt et hash du même NIR → bytes différents
  5. `Deno.test("handler rejette absence de header Authorization avec 401")` : `Request("http://localhost/encrypt", { method: "POST" })` → response.status = 401
  6. `Deno.test("handler decrypt insère une ligne audit_logs action='patient.nir.decrypt'")` : mock supabase client + assert insert appelé avec `action: "patient.nir.decrypt"` (utiliser un client Supabase stub local — cf. pattern dans RESEARCH §1 lignes 124-132)

**Aucun mock ne doit logger le NIR clair.** Tester explicitement : `assertEquals(consoleLogs.find(l => l.includes("1801234567823")), undefined)`.

Conventions :
- Fichier ≤ 300 lignes
- Messages d'erreur attendus en français (`"Non autorisé"`, `"NIR illisible"`)
  </action>
  <verify>
    <automated>cd /home/user/TAP/supabase/functions &amp;&amp; deno test --allow-env --allow-net --allow-read nir/index.test.ts 2&gt;&amp;1 | tail -20 &amp;&amp; echo "RED expected: import './index.ts' doit ÉCHOUER (Module not found)"</automated>
  </verify>
  <acceptance_criteria>
    - `wc -l supabase/functions/nir/index.test.ts` ≥ 60 lignes
    - `grep -c "Deno.test(" supabase/functions/nir/index.test.ts` == 6
    - `grep -c "encryptNir\\|decryptNir\\|hashNir" supabase/functions/nir/index.test.ts` ≥ 6 (utilisations multiples)
    - `grep -c "assertEquals\\|assertNotEquals\\|assertRejects" supabase/functions/nir/index.test.ts` ≥ 6
    - `grep -c "patient.nir.decrypt" supabase/functions/nir/index.test.ts` ≥ 1
    - `grep -c "1801234567823" supabase/functions/nir/index.test.ts | grep -v "^#"` ≥ 1 mais aucune occurrence de `console.log.*1801234567823`
    - `! grep -E "console\\.log\\([^)]*nir" supabase/functions/nir/index.test.ts` (aucun log de NIR clair)
    - `deno test ... 2>&1 | grep -c "Module not found\\|Cannot find module\\|error"` ≥ 1 (RED attendu)
    - `test -f supabase/functions/import_map.json && test -f supabase/functions/deno.json`
  </acceptance_criteria>
  <done>3 fichiers existent, le test Deno échoue en RED car index.ts absent, aucun NIR clair n'est loggué.</done>
</task>

<task type="auto">
  <name>Tâche 3 : Scaffold Playwright config + helper auth + scénario E2E patient-flow + test Vitest validators</name>
  <files>apps/web/playwright.config.ts, apps/web/e2e/helpers/auth.ts, apps/web/e2e/patient-flow.spec.ts, apps/web/package.json, packages/shared/src/validators/__tests__/patient.test.ts</files>
  <read_first>
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-RESEARCH.md (lignes 358-378, scénario E2E ; lignes 354-356 helper login programmatique)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-PATTERNS.md (lignes 419-447, pattern tests Vitest)
    - /home/user/TAP/.planning/phases/01-referentiel-patients/01-CONTEXT.md (lignes 226-243, format NIR masqué `1•••••••••76 23`, drawer 400 px, debounce 150 ms)
    - /home/user/TAP/packages/shared/src/validators/__tests__/common.test.ts (style Vitest)
  </read_first>
  <action>
**apps/web/playwright.config.ts** (≥ 20 lignes) :
- `import { defineConfig, devices } from '@playwright/test';`
- `testDir: './e2e'`, `fullyParallel: true`, `retries: process.env.CI ? 2 : 0`
- `use: { baseURL: 'http://127.0.0.1:3000', trace: 'on-first-retry' }`
- `webServer: { command: 'npx concurrently --kill-others-on-fail "pnpm -C apps/web dev" "supabase functions serve nir --env-file .env.local --no-verify-jwt"', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120_000, env: { APP_NIR_ENCRYPTION_KEY: process.env.APP_NIR_ENCRYPTION_KEY ?? '', APP_NIR_SEARCH_KEY: process.env.APP_NIR_SEARCH_KEY ?? '', SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '', NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '' } }`
- Le `webServer` lance **simultanément** le dev server Next.js ET `supabase functions serve nir` via `concurrently` (sinon l'Edge Function NIR est injoignable et `patient-flow.spec.ts` échoue à l'étape 1 — création patient).
- 1 seul projet `chromium` (Phase 1, pas de Firefox/Safari)
- `expect: { timeout: 5000 }`

**apps/web/package.json** :
- Ajouter `concurrently` en `devDependencies` (`^9.0.0` ou plus récent) — utilisé par le `webServer.command` Playwright pour lancer Next.js dev + `supabase functions serve nir` en parallèle.

**apps/web/e2e/helpers/auth.ts** (≥ 25 lignes) :
- Fonction `loginAsRegulateur(page: Page, email = 'reg-demo@tap.test', password = 'demo1234!'): Promise<void>`
- Implémente un `POST` direct vers `${SUPABASE_URL}/auth/v1/token?grant_type=password` avec `apikey` header, parse la réponse `{access_token, refresh_token}`, set les cookies `sb-access-token` et `sb-refresh-token` via `page.context().addCookies([...])` avec `domain: 'localhost'`, `path: '/'`, `httpOnly: true`, `sameSite: 'Lax'`
- Pas de navigation UI, pas de fillForm. Helper programmatique pur.
- Exporter aussi `clearAuth(page)` qui supprime les cookies (utile pour tests d'auth gate).
- Variable d'env utilisée : `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` (apikey).

**apps/web/e2e/patient-flow.spec.ts** (≥ 50 lignes) — scénario unique exhaustif (RED jusqu'à wave 3) :
```ts
import { test, expect } from '@playwright/test';
import { loginAsRegulateur } from './helpers/auth';

test('régulatrice : créer → rechercher fuzzy 2 chars → drawer → édition → audit', async ({ page }) => {
  await loginAsRegulateur(page);
  // 1. Création
  await page.goto('/patients/new');
  await page.getByLabel('Nom').fill('Hoarau');
  await page.getByLabel('Prénom').fill('Patrick');
  await page.getByLabel('Date de naissance').fill('1980-01-23');
  await page.getByLabel('NIR').fill('1801234567823');
  await page.getByLabel('Adresse').fill('12 rue Pasteur');
  await page.getByLabel('Code postal').fill('97400');
  await page.getByLabel('Ville').fill('Saint-Denis');
  await page.getByRole('button', { name: /créer/i }).click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/);

  // 2. Recherche fuzzy 2 chars
  await page.goto('/patients');
  const search = page.getByPlaceholder(/rechercher/i);
  await search.fill('h');
  // 1 char ne déclenche pas la requête
  await expect(page.getByText('Hoarau Patrick')).toHaveCount(0);
  await search.fill('ho');
  // debounce 150 ms : doit apparaître < 1 s
  await expect(page.getByText('Hoarau Patrick')).toBeVisible({ timeout: 1000 });

  // 3. Drawer 400 px
  await page.getByText('Hoarau Patrick').click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  // largeur fixe 400 px
  const box = await drawer.boundingBox();
  expect(box?.width).toBe(400);
  // NIR masqué par défaut, format 1•••••••••76 23
  await expect(drawer.getByText(/1•••••••••\\d{2}\\s*\\d{2}/)).toBeVisible();

  // 4. Édition canal préféré
  await drawer.getByRole('link', { name: /voir la fiche complète/i }).click();
  await page.getByRole('link', { name: /modifier/i }).click();
  await page.getByLabel('Canal préféré').selectOption('sms');
  await page.getByLabel('Consentement SMS').check();
  await page.getByRole('button', { name: /enregistrer/i }).click();

  // 5. Audit_logs : vérif via API service_role (POST direct vers /rest/v1/audit_logs)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(
    `${supabaseUrl}/rest/v1/audit_logs?action=eq.patient.update&order=created_at.desc&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const rows = await res.json();
  expect(rows[0]?.action).toBe('patient.update');
  expect(rows[0]?.metadata?.new).not.toHaveProperty('nir_encrypted');
});
```

**packages/shared/src/validators/__tests__/patient.test.ts** (≥ 60 lignes) :
- Étendre les cas existants pour le `patientSchema`
- 10 cas Vitest :
  1. `patientSchema.parse` accepte un patient minimal valide (prenom, nom, date_naissance, adresse complète)
  2. Refuse prénom vide
  3. Refuse date_naissance mauvais format
  4. NIR optionnel — accepté absent
  5. Téléphone normalisé : `'06 92 12 34 56'` → `'0692123456'`
  6. **Nouveau** : `consentement_sms: true` SANS `consentement_sms_at` lève l'erreur `'Horodatage de consentement requis...'`
  7. **Nouveau** : `consentement_sms: false` SANS `consentement_sms_at` est accepté
  8. **Nouveau** : `genre` accepte 'M', 'F', 'X' et refuse 'autre'
  9. **Nouveau** : `contact_urgence` requiert nom + téléphone réunionnais valide ; téléphone hors 974 refusé
  10. **Nouveau** : helper `normalizeNir('1 80 12 34 567 823')` retourne `'1801234567823'` (suppression espaces)

Ces tests échoueront en wave 0 (extensions du schéma faites en PLAN-2). Test ID 1-5 doivent passer immédiatement (le schéma actuel les supporte) ; tests 6-10 échouent en RED.
  </action>
  <verify>
    <automated>cd /home/user/TAP &amp;&amp; pnpm -C packages/shared test 2&gt;&amp;1 | tail -15 &amp;&amp; echo "---" &amp;&amp; cd apps/web 2&gt;/dev/null &amp;&amp; pnpm exec playwright test --list 2&gt;&amp;1 | head -5 || echo "(apps/web inexistant en wave 0 — config seule, --list fail OK)"</antml-parameter></automated>
  </verify>
  <acceptance_criteria>
    - `wc -l apps/web/playwright.config.ts` ≥ 20
    - `cd apps/web && grep -E "concurrently.*supabase functions serve nir" playwright.config.ts` retourne ≥ 1 ligne (B-4 : Edge Function NIR lancée en parallèle du dev server)
    - `grep -E "APP_NIR_ENCRYPTION_KEY|APP_NIR_SEARCH_KEY" apps/web/playwright.config.ts` retourne ≥ 2 lignes (env vars NIR propagées au webServer)
    - `grep -E '"concurrently"' apps/web/package.json` retourne ≥ 1 ligne (devDependency présente)
    - `wc -l apps/web/e2e/helpers/auth.ts` ≥ 25
    - `wc -l apps/web/e2e/patient-flow.spec.ts` ≥ 50
    - `wc -l packages/shared/src/validators/__tests__/patient.test.ts` ≥ 60
    - `grep -c "loginAsRegulateur" apps/web/e2e/patient-flow.spec.ts` ≥ 1
    - `grep -c "1•••••••••" apps/web/e2e/patient-flow.spec.ts` ≥ 1 (vérification NIR masqué codifié)
    - `grep -c "boundingBox\\|width.*400" apps/web/e2e/patient-flow.spec.ts` ≥ 1 (drawer 400 px codifié)
    - `grep -c "search.fill('h')\\|search.fill(\"h\")" apps/web/e2e/patient-flow.spec.ts` ≥ 1 (recherche 1 char ne déclenche pas)
    - `grep -c "audit_logs" apps/web/e2e/patient-flow.spec.ts` ≥ 1
    - `grep -c "patient.update\\|patient.insert\\|patient.create" apps/web/e2e/patient-flow.spec.ts` ≥ 1
    - `grep -c "consentement_sms_at" packages/shared/src/validators/__tests__/patient.test.ts` ≥ 1
    - `grep -c "normalizeNir" packages/shared/src/validators/__tests__/patient.test.ts` ≥ 1
    - `pnpm -C packages/shared test 2>&1 | grep -cE "(FAIL|fail).*patient"` ≥ 1 (tests 6-10 RED attendu)
  </acceptance_criteria>
  <done>Config Playwright + helper auth programmatique + 1 scénario E2E exhaustif + tests Vitest étendus, tous en RED (sauf cas 1-5 qui passent déjà avec le schéma actuel).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tests pgTAP → Postgres | Les fixtures pgTAP s'exécutent en `service_role` ; un test mal écrit pourrait masquer un défaut RLS |
| Tests Deno → futur Edge Function | L'environnement de test ne doit jamais persister les clés AES en disque |
| E2E helper auth → Supabase | Le helper utilise l'anon key + identifiants de démo, jamais le service_role pour login |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-01-01 | Information Disclosure | supabase/tests/patients.sql | LOW | mitigate | Les fixtures n'utilisent que des UUIDs et noms factices ; aucun vrai NIR. Le test utilise `'1801234567823'` (NIR factice valide en checksum) — documenté en commentaire d'en-tête |
| T-01-02 | Information Disclosure | supabase/functions/nir/index.test.ts | HIGH | mitigate | Test explicite dans la tâche 2 : `assertEquals(consoleLogs.find(l => l.includes(nir)), undefined)`. Lint custom à ajouter en wave 1 (rule `no-console-log-nir`) |
| T-01-03 | Tampering | apps/web/e2e/helpers/auth.ts | MEDIUM | mitigate | Helper programmatique passe par l'API publique Supabase Auth, jamais par le service_role pour le login. Le service_role n'est utilisé que pour la lecture finale d'audit_logs et reste en variable d'env CI uniquement |
| T-01-04 | Repudiation | scaffolds RED | LOW | accept | Aucun audit log écrit pendant les tests scaffolds (rollback transaction) — pas de risque de confusion en production |
</threat_model>

<verification>
- `wc -l` sur les 7 fichiers de tests est ≥ aux minimums déclarés en `must_haves.artifacts`
- `pnpm db:test 2>&1 | grep -c "relation .* does not exist"` ≥ 1 (RED migrations attendu)
- `cd supabase/functions && deno test --allow-env --allow-net --allow-read nir/index.test.ts 2>&1 | grep -c "Module not found\\|Cannot find"` ≥ 1 (RED Edge Function attendu)
- `pnpm -C packages/shared test 2>&1 | grep -cE "(FAIL|fail).*(consentement_sms_at|normalizeNir|genre|contact_urgence)"` ≥ 1 (RED tests étendus attendu)
- `apps/web/playwright.config.ts` parse correctement : `cd apps/web && node -e "require('./playwright.config.ts')" 2>&1` ne crashe pas (ou via `npx tsx`)
- Aucune occurrence de `console.log\([^)]*nir` dans les fichiers créés (`grep -rn "console.log" supabase/functions/nir/index.test.ts apps/web/e2e/` retourne 0 ligne contenant `nir`)
</verification>

<success_criteria>
- Les 3 fichiers pgTAP existent, totalisent ≥ 35 assertions (`select plan(N)` cumulé), échouent en RED parce que la migration 003 n'est pas encore appliquée
- Le scaffold Deno test couvre les 6 cas critiques (round-trip, IV unique, hash déterministe + normalisation espaces, JWT 401, audit log decrypt, pas de NIR en console)
- Le helper Playwright `loginAsRegulateur` est programmatique (POST `/auth/v1/token`), zéro navigation UI
- Le scénario E2E `patient-flow.spec.ts` codifie tous les seuils CONTEXT.md : drawer 400 px (`boundingBox().width === 400`), debounce déclenchement 2 chars (`search.fill('h')` ne trouve rien), NIR masqué `1•••••••••XX YY` (regex), audit_logs sans `nir_encrypted`
- Le fichier de tests Vitest étendu couvre les 5 nouveaux cas (consentement_sms_at, genre, contact_urgence, normalizeNir, archive)
</success_criteria>

<output>
Après complétion, créer `.planning/phases/01-referentiel-patients/01-1-SUMMARY.md` documentant : nombre de tests RED par couche, commandes de vérification automatisées disponibles, baseline RED capturée pour gate de la wave 1.
</output>

## Revision Log

- **2026-05-06 — Itération 1/3 — B-4 fix appliqué** : le `webServer` Playwright lance désormais à la fois le dev server Next.js ET `supabase functions serve nir` en parallèle (via `concurrently --kill-others-on-fail`). Les variables d'environnement `APP_NIR_ENCRYPTION_KEY`, `APP_NIR_SEARCH_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont propagées depuis `process.env` vers le `webServer`. `concurrently` ajouté en devDependency dans `apps/web/package.json`. Sans ce correctif, l'Edge Function NIR n'était pas joignable et le test E2E `patient-flow.spec.ts` échouait à l'étape de création de patient.
