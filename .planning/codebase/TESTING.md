# Testing Patterns

**Analysis Date:** 2026-05-12

## Politique de tests (Passe 1 — ADR-003, révisée 2026-05-11)

Politique allégée volontaire pendant les Passes 1, 2 et 3 (CLAUDE.md § 9) :

- **1 test Playwright E2E par passe** sur le golden path complet (les 6 maillons enchaînés).
- **pgTAP RLS systématique** sur toute nouvelle table métier (non négociable).
- **Vitest** sur logique métier nouvelle UNIQUEMENT si non triviale (calcul tarif CGSS, génération récurrence, parseur de date). **PAS** de Vitest sur les Server Actions, les wrappers de query, les composants React.
- **Smoke test preview maintenu** (CLAUDE.md § 13.5) : 1 test Playwright qui prouve que la preview Vercel ne casse pas.
- **Pas de Wave 0 RED dédiée** systématique : directement Wave 1 avec tests minimaux à la livraison (sauf logique non triviale).

**Preuve canonique** d'une passe livrée = test Playwright E2E golden path vert sur preview Vercel + revue manuelle dirigeant documentée dans le SUMMARY.

**Coverage 100 % branches obligatoire** sur `packages/pricing` (DEC-013, Phase 4+) et `packages/recurrence` (Phase 5+). Pas encore créés au 2026-05-12.

## CI cloud = canonical (CLAUDE.md § 13.5)

**Vercel preview + Supabase staging + GitHub Actions** = la vérité. La sandbox locale n'est qu'un brouillon. Les SUMMARY.md ne doivent **plus jamais** contenir « sandbox-bloqué », « runtime CI human_needed », « Playwright sandbox-limited ».

**Workflows GitHub Actions** (`.github/workflows/`) :
- `ci.yml` — install, lint, format:check, typecheck, test, rls-tests (pgTAP), e2e (PR uniquement)
- `cd.yml` — déploiement Vercel + push migrations + seeds
- `preview-smoke.yml` — `apps/web/tests/smoke/preview.spec.ts` sur chaque preview Vercel ready
- `setup-vercel.yml` — bootstrap one-shot (env vars + secrets)
- `sync-types.yml` — régénération `packages/database/src/types.gen.ts`

Un échec preview-smoke **bloque le merge**.

## Frameworks et runners

| Outil | Version | Scope | Localisation |
|---|---|---|---|
| Vitest | `^2.0.5` | Unit tests TS purs (validators zod, helpers) | `packages/shared` |
| Playwright | `^1.47.0` | E2E + smoke preview | `apps/web/e2e/`, `apps/web/tests/` |
| pgTAP | natif Supabase CLI | RLS + contraintes Postgres | `supabase/tests/` |
| pytest | À venir Phase 10+ | Service Python OR-Tools | `services/optimizer/` |

**Commandes** (`package.json` racine) :
```bash
pnpm test           # turbo run test → vitest run dans @tap/shared
pnpm test:e2e       # turbo run test:e2e → playwright test dans apps/web
pnpm db:test        # supabase test db (pgTAP)
pnpm lint           # turbo run lint
pnpm typecheck      # turbo run typecheck
pnpm format:check   # prettier --check .
```

## Vitest — `packages/shared`

**Config** : `packages/shared/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    env: { TZ: 'Indian/Reunion' },          // critique pour parse-freeform-date
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
```

**Localisation** : `__tests__/` colocalisé avec le code source.
```
packages/shared/src/
├── validators/
│   ├── ride.ts
│   ├── patient.ts
│   └── __tests__/
│       ├── ride.test.ts
│       ├── patient.test.ts
│       └── common.test.ts
└── utils/
    ├── parse-freeform-date.ts
    └── __tests__/
        ├── parse-freeform-date.test.ts
        ├── patient-anonymize.test.ts
        ├── patient-data-export.test.ts
        ├── legal-token.test.ts
        └── patient-note.test.ts
```

**Pattern de fichier** (`packages/shared/src/validators/__tests__/ride.test.ts`) :
```ts
import { describe, expect, it } from 'vitest';
import { rideExpressInputSchema, rideDraftSchema } from '../ride';

const baseValide = {
  patient_id: '11111111-1111-1111-1111-111111111111',
  scheduled_at: '2026-05-15T14:30:00+04:00',
  pickup_address: '12 rue Pasteur',
  dropoff_address: 'CHU Bellepierre',
};

describe('rideExpressInputSchema', () => {
  it('1. accepte une saisie minimale et applique les defaults', () => {
    const parsed = rideExpressInputSchema.parse(baseValide);
    expect(parsed.transport_mode).toBe('taxi_conventionne');
    expect(parsed.urgency).toBe('programmee');
  });

  it('2. refuse un patient_id non-UUID avec message « Patient requis »', () => {
    const result = rideExpressInputSchema.safeParse({ ...baseValide, patient_id: 'pas-un-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0]?.message).toBe('Patient requis');
    }
  });
});
```

**Conventions Vitest du repo** :
- En-tête de fichier avec encadré ASCII + référence ADR/Phase/DEC + état attendu (RED / GREEN).
- Numérotation explicite des `it()` (`'1. accepte …'`, `'2. refuse …'`) pour mapping rapide vers le critère SC.
- Description française systématique (jamais d'anglais).
- Fixture `baseValide` partagée + spread `{ ...baseValide, champ: valeurInvalide }` pour chaque cas négatif.
- `safeParse` + `if (!result.success)` typeguard pour accéder à `result.error.errors[0]?.message` sans cast.
- Pas de mock : on teste la logique pure (validators, helpers). Si un mock est nécessaire → c'est probablement le mauvais niveau d'abstraction (politique allégée).

**Conditional describe pour dépendance TZ** (`parse-freeform-date.test.ts:13-14`) :
```ts
const TZ_OK = process.env.TZ === 'Indian/Reunion';
const describeTz = TZ_OK ? describe : describe.skip;
```
Évite des faux négatifs en local si la variable d'env n'est pas posée. Sanity check global non skippé pour détecter une dérive d'API.

## Playwright — apps/web

**Config** : `apps/web/playwright.config.ts`
```ts
export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.ts', 'tests/**/*.spec.ts'],
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    locale: 'fr-FR',
    timezoneId: 'Indian/Reunion',          // ← critique cohérence régulatrice
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx concurrently --kill-others-on-fail "pnpm -C apps/web dev" "supabase functions serve nir …"',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Organisation** :
```
apps/web/
├── e2e/                                # Phase 1 historique
│   ├── helpers/auth.ts                 # loginAsRegulateur(page)
│   └── patient-flow.spec.ts            # golden path patient (PAT-01..07)
└── tests/
    ├── smoke/preview.spec.ts           # smoke preview Vercel (CLAUDE.md § 13.5)
    ├── e2e/saisie-express.spec.ts      # SAIS-01..06 (Phase 2)
    ├── admin/                          # registre PDF, DPIA, breach countdown
    ├── public/                         # cookie banner, pages légales
    └── portail/                        # access flow patient
```

**Sélecteurs stables** — discipline du repo :
- `getByRole('button', { name: /Créer la course/i })` plutôt que classes / IDs.
- `getByLabel('Adresse de prise en charge')` aligné sur `aria-label` (composants exposent des labels FR explicites).
- `getByRole('dialog')` + `aria-label="Saisie express d'une course"` pour les modals.
- `getByText(/Hoarau Patrick/)` pour le contenu seedé démo.

**Pattern smoke preview** (`apps/web/tests/smoke/preview.spec.ts`) :
```ts
const REG_DEMO_EMAIL = 'regulateur@demo.tap';
const REG_DEMO_PASSWORD = 'demo1234!';

async function loginRegulateur(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(REG_DEMO_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(REG_DEMO_PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

test.describe('Smoke preview Vercel — Visible Progress Mandate', () => {
  test('login page accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'TAP Régulation' })).toBeVisible();
  });
  test('Phase 2 — raccourci Cmd/Ctrl+Shift+K déclenche le modal global', async ({ page }) => {
    await loginRegulateur(page);
    await page.goto('/patients');
    await page.keyboard.press('Control+Shift+K');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2000 });
  });
});
```

**Pattern E2E golden path** (`apps/web/tests/e2e/saisie-express.spec.ts`) :
- `test.beforeEach` réutilise `loginRegulateur` partagé inline.
- `test.describe('Saisie express course (SAIS-01..06)', …)` — un `describe` par feature, un `test` par critère SC numéroté.
- Assertions critères chiffrés du CDC : `expect(elapsed).toBeLessThan(30_000);` (DEC-005 saisie < 30 s).
- **Capture flag** pour générer screenshots showcase via env var :
  ```ts
  const CAPTURE_FLAG = process.env.PHASE_2_CAPTURES === '1';
  async function screenshotIfFlag(page: Page, fileName: string): Promise<void> {
    if (!CAPTURE_FLAG) return;
    await page.screenshot({ path: path.join(SHOWCASE_DIR, fileName), fullPage: false });
  }
  ```
  Capture les visuels pour `docs/showcase/{phase}/` (Visible Progress Mandate).

**Vérification largeur drawer** — pattern unique du repo (`apps/web/e2e/patient-flow.spec.ts:56-57`) :
```ts
const drawer = page.getByRole('dialog');
const box = await drawer.boundingBox();
expect(box?.width).toBe(400);     // patient = 400px ; course = 480px
```

**Patient seed tolérant** (`saisie-express.spec.ts:35-36`) : `Ho` + regex `/Ho\w*/i` pour absorber les variantes de seed démo.

**Comptes démo persistants** (CLAUDE.md § 13.5) — réutilisés dans tous les E2E :
| Email | Password | Redirect |
|---|---|---|
| `dirigeant@demo.tap` | `demo1234!` | `/patients` |
| `regulateur@demo.tap` | `demo1234!` | `/patients` |
| `chauffeur@demo.tap` | `demo1234!` | `/conduite` |

## pgTAP — `supabase/tests/`

**Couverture systématique** : toute table métier a au moins un fichier `<table>_rls.sql`.

**Fichiers présents** :
```
supabase/tests/
├── foundations.sql                       # organizations + profiles + audit_logs
├── patients.sql                          # RLS + index + audit (Phase 1)
├── patient_constraint.sql                # contraintes CHECK
├── patient_operational_note.sql          # RLS notes opérationnelles
├── drivers_rls.sql                       # RLS chauffeurs
├── vehicles_rls.sql                      # RLS véhicules
├── rides_rls.sql                         # RLS + defaults + grants (Phase 2/3)
├── rides_audit.sql                       # trigger audit_logs
├── rides_execution_transitions.sql       # transitions statut
├── ride_draft_rls.sql                    # author_id = auth.uid()
├── rgpd_anonymize_patient.sql            # RPC anonymisation
├── check_breach_deadlines.sql            # countdown CNIL 72h
├── data_breach_incident_rls.sql
├── data_processing_register_rls.sql
├── dpa_record_rls.sql
├── dpia_record_rls.sql
└── patient_data_request_rls.sql
```

**Pattern de fichier** (`supabase/tests/rides_rls.sql`) :
```sql
begin;

select plan(15);

-- Fixtures multi-tenant : Alpha + Bravo + users figés
insert into public.organizations (id, nom, ville, code_postal) values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha', 'Saint-Denis', '97400'),
  ('22222222-2222-2222-2222-222222222222', 'Org Bravo', 'Saint-Pierre', '97410');

insert into auth.users (...) values
  ('aaaaaaaa-...', 'authenticated', 'alpha-dir@test.tap', ...),
  ('cccccccc-...', 'authenticated', 'alpha-reg@test.tap', ...),
  ('dddddddd-...', 'authenticated', 'bravo-reg@test.tap', ...);

insert into public.profiles (id, organization_id, role, ...) values
  ('aaaa...', '1111...', 'dirigeant', ...),
  ('cccc...', '1111...', 'regulateur', ...),
  ('dddd...', '2222...', 'regulateur', ...);

-- 1-2. RLS activée + forcée
select ok((select relrowsecurity from pg_class where oid = 'public.rides'::regclass),
          'RLS activée sur rides');
select ok((select relforcerowsecurity from pg_class where oid = 'public.rides'::regclass),
          'RLS forcée sur rides (force row level security)');

-- 3-5. alpha-reg crée une course Alpha + voit sa course
set local role authenticated;
set local "request.jwt.claim.sub" = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select lives_ok($$ insert into public.rides (...) values (...) $$,
                'alpha-reg INSERT rides OK (rôle régulateur autorisé)');

-- 6. Cross-tenant : bravo-reg ne voit rien
set local "request.jwt.claim.sub" = 'dddddddd-...';
select is((select count(*)::int from public.rides), 0,
          'bravo-reg ne voit pas la course Alpha (cross-tenant strict)');

-- 7. Cross-tenant : bravo-reg ne peut PAS INSERT
select throws_ok($$ insert into public.rides (... org alpha ...) $$,
                 '42501', null, 'bravo-reg refusé sur cross-org INSERT (WITH CHECK)');

-- 13. Grants : authenticated SELECT/INSERT/UPDATE ; pas DELETE
select ok(has_table_privilege('authenticated', 'public.rides', 'INSERT')
          and not has_table_privilege('authenticated', 'public.rides', 'DELETE'),
          'authenticated : INSERT/SELECT/UPDATE OK ; DELETE refusé');

-- 14. anon refusé
select ok(not has_table_privilege('anon', 'public.rides', 'SELECT'),
          'anon refusé sur rides (revoke all from anon)');

select * from finish();
rollback;
```

**Conventions pgTAP** :
- Wrappé dans `begin; … rollback;` pour idempotence des fixtures.
- `select plan(N)` avec compte exact des assertions.
- UUIDs figés `aaaa-…`, `cccc-…`, `dddd-…`, `1111-…`, `2222-…`, `9999-…` réutilisés dans tous les fichiers (pattern dupliqué de `foundations.sql`).
- 3 acteurs minimum : `alpha-dir` (dirigeant), `alpha-reg` (régulateur), `bravo-reg` (régulateur autre tenant). Phase 3 ajoute `alpha-chauffeur`.
- `set local role authenticated;` + `set local "request.jwt.claim.sub" = '…';` pour simuler un user authentifié.
- 4 vérifications systématiques par table :
  1. `relrowsecurity = true`
  2. `relforcerowsecurity = true`
  3. Cross-tenant SELECT count = 0
  4. Cross-tenant INSERT → `throws_ok '42501'`
- Test des grants : `has_table_privilege('authenticated', …, 'DELETE')` doit être faux (archivage logique).
- Test grants anon : `has_table_privilege('anon', …, 'SELECT')` doit être faux.
- Test des defaults métier : `select is((select transport_mode::text from public.rides limit 1), 'taxi_conventionne', 'default transport_mode = taxi_conventionne');`
- Commentaires français entre sections.

## Edge Functions

Un test Deno colocalisé : `supabase/functions/nir/index.test.ts` (chiffrement NIR). Exécuté manuellement ou via `supabase functions test`. Pas dans le runner CI principal — l'Edge Function `nir` est servie par `concurrently` pendant `playwright test` (`apps/web/playwright.config.ts:46`).

## Mocking

**Politique** : pas de mock dans les unit tests (validators / helpers sont purs). Pas de mock dans les pgTAP (rôles Postgres réels via `set local`). Pas de mock dans Playwright (la stack tourne via `webServer` réel).

**Si mock nécessaire** : c'est probablement un signe que le test est au mauvais niveau (politique allégée Passe 1 — CLAUDE.md § 9 anti-pattern « Mock chaîné > 3 niveaux »).

## Anti-patterns tests (CLAUDE.md § 9)

- ❌ `expect(render).toBeTruthy()` sur composant React (smoke + visual review suffisent).
- ❌ Mock chaîné > 3 niveaux.
- ❌ Réécrire le code de prod sous forme de test (« le state passe à 'submitted' quand on submit »).
- ❌ E2E qui duplique le smoke.
- ❌ Test zod re-testant les règles zod (`expect(z.string().parse('foo')).toBe('foo')`).
- ❌ Tests d'intégration UI-API au-delà du golden path.

## Coverage

- Activée v8 (`packages/shared/vitest.config.ts:13`), reporter `text` + `lcov`.
- **Cible 100 % branches** sur `packages/pricing` (DEC-013, à créer Phase 4+) et `packages/recurrence` (Phase 5+) — non négociable.
- Pas de seuil enforced sur les autres packages — politique pragmatique (CLAUDE.md § 9).

## Re-évaluation

Prévue à V1.0 commerciale (premier client payant). Si 0 incident sécurité et 0 incident facturation : politique tenue. Sinon : resserrage sur la zone qui a failli (CLAUDE.md § 9).

---

*Testing analysis: 2026-05-12*
