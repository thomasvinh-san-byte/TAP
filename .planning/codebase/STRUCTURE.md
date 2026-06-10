# Codebase Structure

**Analysis Date:** 2026-06-10
**Last updated:** 2026-06-10

## Directory Layout

```
TAP/
├── CLAUDE.md                          # Project instructions (re-read each session)
├── README.md                          # Quick start
├── package.json                       # Workspace root (pnpm + turbo, overrides Next 15 / React 18)
├── pnpm-workspace.yaml                # Workspaces: apps/*, packages/*, services/* (services/ vide)
├── turbo.json                         # Turborepo pipeline (+ tokens:build)
├── tsconfig.base.json                 # Shared TS config (strict)
├── eslint.config.mjs                  # ESLint 9 flat config (aucun .eslintrc)
├── vercel.json                        # Vercel build / région cdg1
├── .env.example                       # Required env vars (NEVER read contents — listing only)
│
├── .github/workflows/                 # ci, cd, preview-smoke, setup-vercel, sync-types
│
├── .planning/
│   ├── codebase/                      # THIS FOLDER — generated codebase maps
│   ├── phases/                        # Phase plans (jusqu'à ~06.x)
│   ├── intel/                         # Cross-cutting research
│   └── mockups/                       # Visual mockups
│
├── apps/
│   └── web/                           # Single Next.js app (all roles)
│       ├── package.json
│       ├── next.config.mjs            # + wrap Serwist + Sentry
│       ├── sentry.{server,edge}.config.ts
│       ├── style-dictionary.config.mjs
│       ├── tailwind.config.ts
│       ├── playwright.config.ts
│       ├── src/
│       │   ├── app/                   # App Router root
│       │   ├── components/            # Cross-cutting + shadcn/ui + data-table + form
│       │   ├── lib/                   # Wrappers + domaine applicatif (no routing)
│       │   ├── content/legal/         # Pages légales (MDX)
│       │   ├── styles/                # tokens.json + tokens.generated.*
│       │   ├── sw.ts                  # Serwist service worker
│       │   └── middleware.ts          # Auth PKCE middleware
│       ├── public/tiles/              # reunion.pmtiles
│       └── tests/                     # Playwright by domain (admin/public/portail/e2e/smoke)
│
├── packages/
│   ├── database/                      # Supabase types + client factories
│   ├── shared/                        # Pure TS — zod validators + utils
│   ├── pricing/                       # Moteur tarification CGSS
│   ├── recurrence/                    # Génération occurrences + jours fériés 974
│   ├── sms/                           # Consentement + template + adaptateur Twilio
│   └── optimizer-client/              # Vestige HTTP vidé (ADR-010)
│
├── supabase/
│   ├── config.toml
│   ├── seed.sql / seed.demo.sql       # Données + comptes démo
│   ├── migrations/                    # Timestamped .sql (46 fichiers)
│   ├── functions/                     # Edge Functions Deno (_shared, nir, deno.json, import_map.json)
│   └── tests/                         # pgTAP RLS suites (35 fichiers)
│
├── docs/
│   ├── cahier_des_charges_saas_tap_v2.docx   # FUNCTIONAL SOURCE OF TRUTH
│   ├── adr/                           # ADR-001..013
│   ├── observations/                  # Design partner notes
│   └── showcase/                      # Phase deliverable screenshots/GIFs
│
└── scripts/                           # Repo scripts (manual)
```

> Note : `services/` n'existe plus (microservice Python optimizer abandonné, ADR-010). Le glob `services/*` reste déclaré dans `pnpm-workspace.yaml` mais ne matche rien.

## Directory Purposes

**`apps/web/src/app/`:** App Router, toutes les routes. 5 route groups + `api/`, `setup/`, `welcome/`, `dev/`, `global-error.tsx`, root `layout.tsx`.

**`apps/web/src/app/(app)/`:** Shell régulateur (desktop-first). Contient `cockpit/`, `courses/`, `patients/`, `tableau-de-bord/`, `providers.client.tsx`, `error.tsx`. `layout.tsx` monte l'orchestrateur ride + nav.

**`apps/web/src/app/(driver)/`:** Shell chauffeur PWA (mobile-first). `conduite/` + `_components/` + `_lib/`. Offline via Serwist + Dexie. `layout.tsx` role `chauffeur` only.

**`apps/web/src/app/(admin)/`:** Back-office dirigeant. `admin/{chauffeurs,vehicules,tarifs,sms-templates,conformite,facturation,maintenance,legal}`.

**`apps/web/src/app/(auth)/`:** Login flow.

**`apps/web/src/app/(public)/`:** Pages légales publiques (bypass auth) + portail patient RGPD (`request/[token]`).

**`apps/web/src/app/api/`:** Route Handlers (anonymous + admin PDF + driver writes + cron SMS + Twilio webhook + optimizer). Voir INTEGRATIONS.md.

**`apps/web/src/components/`:** Widgets transverses + primitives.
- `ui/` — primitives shadcn : `button`, `dialog`, `sheet`, `bottom-sheet` (mobile), `dropdown-menu`, `select`, `segmented-control`, `input`, `textarea`, `label`, `badge`, `compliance-badge`, `checkbox`*, `empty-state`, `skeleton`, `sonner`, `form`, `initials-avatar`
- `data-table/` — `DataTable`, `ListToolbar`, `ListMeta`, `Pagination` (barrel `index.ts`) — scaffolding standard des listes
- `form/` — `form-layout.tsx` (patron) + `field`, `combobox.client`, `number-field`, `password-input.client`
- `page-header/`, `map/`, `messaging/`, `error/` + `app-header`, `nav-tabs.client`, `nav-group-menu.client`, `legal-nav-menu.client`, `theme-toggle.client`, `date-field-fr.client`, `time-field-24.client`, `cookie-banner.client`, `demo-credentials`, `user-menu`

> *`checkbox` : à créer/confirmer dans `components/ui/` si absent ; les autres primitives listées sont présentes.

**`apps/web/src/lib/`:** Helpers transverses + domaine applicatif (no React routing).
- `supabase/{server,client,admin,middleware}.ts` — clients
- `auth/get-auth-context.ts` — résolution rôle
- `geocoding/{ban,geocode-safety-net}.ts` — BAN/Géoplateforme
- `geoloc/` — géolocalisation chauffeur
- `offline/{dexie-instance,dexie-schema,sync-engine,network-listener.client,sw-register.client,use-sync-status}.ts` — PWA offline
- `optimizer/{solve-local,haversine}.ts` — heuristique tournées (ADR-010)
- `sentry/scrub.ts` — scrubbing PII
- `api/{driver-auth,idempotency}.ts`, `pricing/`, `recurrence/`, `sms/`, `pdf/`, `pois/`, `messaging/`, `vehicles/`
- `nir-client.ts`, `dates-fr.ts`, `keyboard-shortcuts.tsx`, `cookie-consent.ts`, `csv.ts`, `nav-config.ts`, `setup-sql.ts`, `utils.ts`, `use-theme.client.ts`, `use-high-contrast.client.ts`

**`apps/web/tests/`:** Playwright groupé par domaine (`admin/`, `portail/`, `public/`, `e2e/`, `smoke/preview.spec.ts` canary).

**`packages/database/src/`:** `types.gen.ts` (GÉNÉRÉ — ne pas éditer), `types.ts`, `client-browser.ts`, `client-server.ts`, `middleware-client.ts`, `index.ts`.

**`packages/shared/src/`:** `validators/` + `utils/` (zéro React, zéro Supabase) + `__tests__/` Vitest co-localisés.

**`supabase/migrations/`:** 46 `.sql` versionnés (foundations → conformité/messagerie interne). Hand-written, committed.

**`supabase/tests/`:** 35 pgTAP (RLS, triggers, RPCs). Hand-written, committed.

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx` — root HTML, anti-FOUC theme
- `apps/web/src/middleware.ts` — auth PKCE + redirects
- `apps/web/src/sw.ts` — service worker PWA
- `apps/web/src/app/(app|driver|admin)/layout.tsx` — shells par rôle

**Configuration:**
- `apps/web/next.config.mjs`, `apps/web/tailwind.config.ts`, `apps/web/style-dictionary.config.mjs`
- `tsconfig.base.json`, `turbo.json`, `eslint.config.mjs`, `vercel.json`, `supabase/config.toml`

**Core Logic:**
- `apps/web/src/lib/supabase/server.ts` — client serveur canonique
- `apps/web/src/lib/auth/get-auth-context.ts` — auth + rôle
- `apps/web/src/app/(app)/courses/actions/` — barrel mutations ride
- `apps/web/src/app/(app)/cockpit/_lib/use-cockpit-*.ts` — realtime cockpit
- `apps/web/src/lib/offline/sync-engine.ts` — rejeu offline chauffeur
- `apps/web/src/lib/optimizer/solve-local.ts` — heuristique tournées
- `apps/web/src/app/(app)/patients/queries.ts` — lectures via `patients_safe`

**Shared UI:**
- `apps/web/src/components/data-table/{data-table,list-toolbar,pagination}.tsx` (`index.ts`)
- `apps/web/src/components/form/form-layout.tsx`
- `apps/web/src/components/ui/bottom-sheet.tsx`, `components/ui/sheet.tsx`

**Testing:**
- `apps/web/tests/smoke/preview.spec.ts` — smoke canonique preview
- `supabase/tests/*.sql` — RLS pgTAP
- `packages/{shared,pricing,recurrence,sms}/src/**/__tests__/*.test.ts` — Vitest
- `apps/web/src/lib/**/*.test.ts` — Vitest co-localisés (geocoding, optimizer, sentry, form, data-table)

## Naming Conventions

**Files:**
- `kebab-case.ts` (modules) ; `kebab-case.client.tsx` (REQUIS pour tout Client Component) ; `kebab-case.tsx` (Server/présentationnel)
- `*.test.ts(x)` co-localisés (Vitest) ; `*.spec.ts` sous `apps/web/tests/<group>/` (Playwright)
- Migrations : `YYYYMMDDHHMMSS_description.sql`
- pgTAP : `<table_or_concern>.sql` sous `supabase/tests/`

**Directories:**
- `(group)/` — route groups (rôle) ; `[param]/` — segment dynamique
- `_components/` — Client Components locaux ; `_lib/` — queries/helpers server-only locaux
- `actions/` — Server Actions multi-fichiers + barrel `index.ts`
- `__tests__/` — Vitest co-localisés dans packages

**Code:**
- Composants `PascalCase` ; hooks `useXxx` ; Server Actions `verbNounAction` ; queries `verbNoun`
- Zod `nounSchema` ; constantes `SCREAMING_SNAKE_CASE` ; tables/colonnes `snake_case`

## Where to Add New Code

**New régulateur page :**
- Page RSC `apps/web/src/app/(app)/<feature>/page.tsx` (prefetch via `QueryClient`)
- Queries `_lib/queries.ts` (`'server-only'` + `@/lib/supabase/server`)
- Actions `actions/` (multi) ou `actions.ts` (mono, < 300 LOC)
- Client components `_components/*.client.tsx`
- Listes : réutiliser `components/data-table/` ; formulaires : `components/form/form-layout.tsx`
- Ajouter la route à la nav (`lib/nav-config.ts` / `(app)/layout.tsx`)

**New chauffeur feature :** sous `(driver)/` (shell mobile, role `chauffeur`). Mutations write → Route Handler `api/driver/...` + idempotency + file Dexie si offline-critique.

**New admin screen :** sous `(admin)/admin/<feature>/` + lien nav.

**New zod schema :** `packages/shared/src/validators/<noun>.ts` + re-export + `__tests__/<noun>.test.ts`.

**New pure utility :** `packages/shared/src/utils/<verb-noun>.ts` + test. Logique métier spécialisée → `packages/{pricing,recurrence,sms}`.

**New table :** migration `supabase/migrations/YYYYMMDDHHMMSS_<noun>.sql` avec `organization_id` + RLS dans le même fichier ; pgTAP `supabase/tests/<noun>_rls.sql` ; types via `sync-types.yml` ou `pnpm db:types` (cast `as never` + `TODO(types)` en attendant) ; seed si pertinent.

**New Server Action :** `'use server'`, zod parse, `getAuthContext`, retourne `ActionState`, `revalidatePath` au succès. Si module a `actions/`, ajouter un fichier + export au barrel.

**New shadcn primitive :** `apps/web/src/components/ui/<primitive>.tsx` (ne pas modifier — wrapper si besoin). Primitive mobile → `bottom-sheet` plutôt que `sheet`.

**New cross-cutting helper :** `apps/web/src/lib/<helper>.ts(x)` (sous-dossier si croissance).

**New E2E test :** smoke transverse → `tests/smoke/preview.spec.ts` ; golden path phase → `tests/e2e/<feature>.spec.ts` ; admin/public/portail → dossier respectif.

## Special Directories

**`packages/database/src/types.gen.ts`:** auto-généré (`pnpm db:types` / cron `sync-types.yml`), committed, jamais édité à la main.

**`apps/web/src/styles/tokens.generated.{css,ts}`:** générés par Style Dictionary (tâche `tokens:build`) depuis `tokens.json`/`tokens.dark.json`.

**`.planning/`:** mémoire de travail inter-sessions (codebase/ généré ; phases/, intel/ écrits à la main). Committed.

**`docs/showcase/`:** livrables visuels par phase (CLAUDE.md § 13.5). Committed (PNG ≤ 500 Ko, MP4/GIF ≤ 5 Mo).

**`apps/web/.next/`, `node_modules/`, `.turbo/`, `supabase/.temp/`:** générés, gitignored.

**`.env`, `.env.local`:** secrets — jamais lire le contenu. Créés par `setup-vercel.yml` (CI) ou copiés de `.env.example` (local).

---

*Structure analysis: 2026-06-10*
