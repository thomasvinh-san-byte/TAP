# Codebase Structure

**Analysis Date:** 2026-05-12

## Directory Layout

```
TAP/
├── CLAUDE.md                          # Project instructions (must be re-read each session)
├── README.md                          # Quick start
├── package.json                       # Workspace root (pnpm + turbo)
├── pnpm-workspace.yaml                # Workspaces: apps/*, packages/*
├── turbo.json                         # Turborepo pipeline
├── tsconfig.base.json                 # Shared TS config (strict)
├── vercel.json                        # Vercel build hooks
├── .nvmrc                             # Node version pin
├── .env.example                       # Required env vars (NEVER read contents — listing only)
│
├── .github/
│   └── workflows/                     # GitHub Actions
│       ├── ci.yml                     # PR: lint + typecheck + pgTAP + Vitest + Playwright
│       ├── cd.yml                     # main: db push + seed + Vercel deploy + functions deploy
│       ├── preview-smoke.yml          # Vercel preview ready → Playwright smoke
│       ├── setup-vercel.yml           # One-shot env wiring (workflow_dispatch)
│       └── sync-types.yml             # Cron 3h UTC → regen types.gen.ts
│
├── .planning/
│   ├── codebase/                      # THIS FOLDER — generated codebase maps
│   ├── phases/                        # Phase plans (00.7, 01, 01.5, 02, 03, 04, 05, 06)
│   ├── intel/                         # Cross-cutting research
│   ├── mockups/                       # Visual mockups
│   └── regle-neutralite-et-ton.md     # Tone & naming rules (no proper names)
│
├── apps/
│   └── web/                           # Single Next.js app (all roles)
│       ├── package.json
│       ├── next.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── playwright.config.ts
│       ├── src/
│       │   ├── app/                   # App Router root
│       │   ├── components/            # Cross-cutting + shadcn/ui
│       │   ├── lib/                   # Wrappers (supabase, auth, dates, shortcuts)
│       │   ├── content/               # Static MDX-like content (legal)
│       │   └── middleware.ts          # Auth PKCE middleware
│       ├── e2e/                       # Playwright legacy (patient-flow)
│       └── tests/                     # Playwright by domain (admin/public/portail/e2e/smoke)
│
├── packages/
│   ├── database/                      # Supabase types + client factories
│   │   └── src/
│   │       ├── index.ts               # Barrel
│   │       ├── types.gen.ts           # GENERATED — do not edit
│   │       ├── types.ts               # Hand-written augments
│   │       ├── client-browser.ts      # createSupabaseBrowserClient
│   │       ├── client-server.ts       # createSupabaseServerClient
│   │       └── middleware-client.ts   # createSupabaseMiddlewareClient
│   └── shared/                        # Pure TS — zod + utils
│       └── src/
│           ├── index.ts               # Barrel (validators + utils)
│           ├── validators/            # patient, ride, driver, vehicle, legal, common, ...
│           │   └── __tests__/         # Vitest co-located
│           └── utils/                 # patient-anonymize, parse-freeform-date, legal-token, ...
│               └── __tests__/         # Vitest co-located
│
├── supabase/
│   ├── config.toml
│   ├── seed.sql                       # Demo data (deployed in non-prod)
│   ├── seed.demo.sql                  # Demo accounts (dirigeant/regulateur/chauffeur)
│   ├── migrations/                    # Timestamped .sql (16 files at 2026-05-12)
│   ├── functions/                     # Edge Functions (Deno)
│   │   ├── _shared/cors.ts
│   │   └── nir/                       # encrypt/decrypt/hash NIR
│   └── tests/                         # pgTAP RLS suites (17 files)
│
├── docs/
│   ├── cahier_des_charges_saas_tap_v2.docx   # FUNCTIONAL SOURCE OF TRUTH
│   ├── adr/                           # ADR-001..003
│   ├── observations/                  # Design partner notes
│   └── showcase/                      # Phase deliverable screenshots/GIFs
│
└── scripts/                           # Repo scripts (manual)
```

## Directory Purposes

**`apps/web/src/app/`:**
- Purpose: Next.js App Router, all routes
- Contains: 6 route groups (see "Naming Conventions" below), `layout.tsx` root, `globals.css`
- Key files: `apps/web/src/app/layout.tsx`, `apps/web/src/middleware.ts`

**`apps/web/src/app/(app)/`:**
- Purpose: Régulateur shell (desktop-first, max-w-[1280px], NavTabs, DraftQueue, ride orchestrator)
- Contains: `patients/`, `courses/`
- Key files: `(app)/layout.tsx` (role guard, mounts `RideExpressOrchestrator`), `(app)/providers.client.tsx` (TanStack Query + Sonner)

**`apps/web/src/app/(driver)/`:**
- Purpose: Chauffeur PWA shell (mobile-first, max-w-[640px])
- Contains: `conduite/` + `conduite/[rideId]/`
- Key files: `(driver)/layout.tsx` (role `chauffeur` only), `(driver)/conduite/_lib/queries.ts`, `(driver)/conduite/actions.ts`

**`apps/web/src/app/(admin)/`:**
- Purpose: Dirigeant back-office
- Contains: `admin/chauffeurs`, `admin/vehicules`, `admin/legal/{registre,dpa,dpo,dpia,breaches,requests}`
- Key files: `(admin)/layout.tsx` (loads `profiles.role` directly without `getAuthContext` for legacy reasons)

**`apps/web/src/app/(auth)/`:**
- Purpose: Login flow
- Contains: `login/page.tsx`, `login/login-form.client.tsx`, `login/actions.ts`
- Key files: `(auth)/login/actions.ts` (signInWithPassword)

**`apps/web/src/app/(public)/`:**
- Purpose: Public legal pages (SSG-friendly, bypass auth middleware)
- Contains: `legal/{cgu,cgv,confidentialite,cookies,dpo,request/[token]}`
- Key files: `(public)/legal/_lib/load-legal.ts`, `(public)/legal/request/[token]/_lib/` (signed token verification)

**`apps/web/src/app/api/`:**
- Purpose: Route Handlers (anonymous flows + admin PDF only)
- Contains: `api/legal/cookie-consent/route.ts`, `api/admin/legal/registre/pdf/route.ts`
- Key files: route.ts files set `export const runtime = 'nodejs'` for service_role / crypto

**`apps/web/src/app/dev/`, `setup/`, `welcome/`:**
- Purpose: Bootstrap helpers (not protected by auth on env-missing path)
- Contains: dev-switcher (role impersonation in non-prod), `/setup` (admin init button), `/welcome` (env-vars helper)

**`apps/web/src/components/`:**
- Purpose: Cross-cutting widgets + shadcn/ui primitives
- Contains: `footer.tsx`, `nav-tabs.client.tsx`, `cookie-banner.client.tsx`, `user-menu.{tsx,client.tsx}`, `demo-credentials.tsx`, `ui/*`
- Key files: `components/ui/sheet.tsx`, `components/ui/dialog.tsx`, `components/ui/form.tsx`, `components/ui/initials-avatar.tsx`

**`apps/web/src/lib/`:**
- Purpose: Cross-cutting helpers (no React)
- Contains: `supabase/{server,client,admin,middleware}.ts`, `auth/get-auth-context.ts`, `dates-fr.ts`, `keyboard-shortcuts.tsx`, `cookie-consent.ts`, `nir-client.ts`, `setup-sql.ts`, `utils.ts`
- Key files: `lib/supabase/server.ts` (canonical RSC/action client), `lib/auth/get-auth-context.ts`

**`apps/web/tests/`:**
- Purpose: Playwright E2E grouped by route group
- Contains: `admin/`, `portail/` (legal portal), `public/`, `e2e/` (régulateur saisie express), `smoke/` (preview canary)
- Key files: `tests/smoke/preview.spec.ts` (single canonical smoke), `tests/e2e/saisie-express.spec.ts`

**`packages/database/src/`:**
- Purpose: Generated types + 3 Supabase client factories
- Contains: see Directory Layout
- Key files: `packages/database/src/types.gen.ts` (DO NOT edit — `pnpm db:types` regenerates)

**`packages/shared/src/`:**
- Purpose: Pure TS — zero React, zero Supabase
- Contains: zod validators + utils
- Key files: `packages/shared/src/validators/ride.ts`, `packages/shared/src/validators/patient.ts`, `packages/shared/src/utils/parse-freeform-date.ts`

**`supabase/migrations/`:**
- Purpose: Versioned schema + RLS + triggers
- Contains: 16 timestamped `.sql` files at 2026-05-12 (foundations → drivers/vehicles/rides_execution → cancel_motif)
- Generated: No (hand-written, committed)
- Committed: Yes (always)

**`supabase/tests/`:**
- Purpose: pgTAP suites (RLS enforcement, triggers, RPCs)
- Contains: 17 `.sql` files
- Generated: No (hand-written)
- Committed: Yes

## Key File Locations

**Entry Points:**
- `apps/web/src/app/layout.tsx`: Root HTML, anti-FOUC theme
- `apps/web/src/middleware.ts`: Auth PKCE + redirect logic
- `apps/web/src/app/(app)/layout.tsx`: Régulateur shell
- `apps/web/src/app/(driver)/layout.tsx`: Chauffeur PWA shell
- `apps/web/src/app/(admin)/layout.tsx`: Admin shell

**Configuration:**
- `apps/web/next.config.mjs`: Next config
- `apps/web/tailwind.config.ts`: Tokens (spacing 4/8/12/16/24/32/48/64)
- `tsconfig.base.json`: TS strict baseline
- `turbo.json`: Pipeline (dev, build, lint, typecheck, test)
- `vercel.json`: Vercel deploy
- `supabase/config.toml`: Local Supabase

**Core Logic:**
- `apps/web/src/lib/supabase/server.ts`: Canonical Supabase server client
- `apps/web/src/lib/auth/get-auth-context.ts`: Auth + role resolution
- `apps/web/src/app/(app)/courses/actions/`: Ride mutation barrel (8 files)
- `apps/web/src/app/(app)/courses/_lib/queries.ts` + `queries-enriched.ts`: Ride reads
- `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx`: Multi-instance modal reducer
- `apps/web/src/app/(app)/patients/queries.ts`: Patient reads via `patients_safe`
- `apps/web/src/app/(driver)/conduite/_lib/queries.ts`: Driver upcoming rides
- `apps/web/src/app/(driver)/conduite/actions.ts`: Driver start/end actions

**Testing:**
- `apps/web/tests/smoke/preview.spec.ts`: Canonical preview smoke (login, /patients, /courses, Cmd+Shift+K)
- `apps/web/tests/e2e/saisie-express.spec.ts`: Phase 2 golden path
- `supabase/tests/rides_rls.sql`: RLS coverage rides
- `supabase/tests/patients.sql`: RLS coverage patients
- `packages/shared/src/**/__tests__/*.test.ts`: Vitest (validators + utils)

## Naming Conventions

**Files:**
- `kebab-case.ts` (regular modules, e.g. `get-auth-context.ts`)
- `kebab-case.client.tsx` (REQUIRED for any Client Component — convention enforced; e.g. `ride-drawer.client.tsx`)
- `kebab-case.tsx` (Server Components / pure presentational without `'use client'`)
- `*.test.ts` co-located under `__tests__/` (Vitest)
- `*.spec.ts` under `apps/web/tests/<group>/` (Playwright)
- Migrations: `YYYYMMDDHHMMSS_description.sql` (e.g. `20260512000001_drivers.sql`)
- pgTAP: `<table_or_concern>.sql` under `supabase/tests/`

**Directories:**
- `(group)/` — Next.js route groups (no URL impact), used for role-scoped shells
- `[param]/` — dynamic route segments
- `_components/` — feature-local Client Components (underscore = excluded from routing)
- `_lib/` — feature-local server-only queries/helpers
- `_actions/` — feature-local server actions split (used in admin/legal)
- `actions/` — Server Action folder when split into multiple files (rides only currently); barrel `index.ts` re-exports
- `__tests__/` — co-located Vitest tests in packages

**Code:**
- Components: `PascalCase` (e.g. `RideExpressOrchestrator`, `PatientDrawer`)
- Hooks: `useXxx` (e.g. `useGlobalShortcut`, `useRideOrchestrator`)
- Server Actions: `verbNounAction` (e.g. `createRideAction`, `startRideAction`, `getPatientByIdAction`)
- Server queries (non-action): `verbNoun` (e.g. `listRides`, `searchPatients`, `getRideForDriver`)
- Zod schemas: `nounSchema` (e.g. `rideExpressInputSchema`, `patientSchema`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g. `APP_TABS`, `REUNION_OFFSET_HOURS`, `REGULATEUR_OR_DIRIGEANT`)
- DB tables/columns: `snake_case` (e.g. `ride_draft`, `patient_id`, `nir_search_hash`)

## Where to Add New Code

**New régulateur page (e.g. `/factures`):**
- Page: `apps/web/src/app/(app)/factures/page.tsx` (RSC, prefetch via `QueryClient`)
- Queries: `apps/web/src/app/(app)/factures/_lib/queries.ts` (`'server-only'` + `createClient()` from `@/lib/supabase/server`)
- Actions: `apps/web/src/app/(app)/factures/actions/` if > 1 mutation file; else `actions.ts` with `'use server'`
- Client components: `apps/web/src/app/(app)/factures/_components/*.client.tsx`
- Add route to `APP_TABS` in `apps/web/src/app/(app)/layout.tsx:22`

**New chauffeur feature:**
- Add under `apps/web/src/app/(driver)/` — but the shell forces `max-w-[640px]` and role `chauffeur` only
- Reuse `getAuthContext` from `@/lib/auth/get-auth-context.ts` and check `ctx.role === 'chauffeur'`

**New admin screen:**
- Under `apps/web/src/app/(admin)/admin/<feature>/`
- Add link in `apps/web/src/app/(admin)/layout.tsx:44` nav

**New zod schema:**
- File: `packages/shared/src/validators/<noun>.ts`
- Re-export from `packages/shared/src/validators/index.ts`
- Test: `packages/shared/src/validators/__tests__/<noun>.test.ts`

**New pure utility (no React, no Supabase):**
- File: `packages/shared/src/utils/<verb-noun>.ts`
- Re-export from `packages/shared/src/utils/index.ts` (via root barrel auto-cascade)
- Test: `packages/shared/src/utils/__tests__/<verb-noun>.test.ts`

**New table:**
- Migration: `supabase/migrations/YYYYMMDDHHMMSS_<noun>.sql` — MUST include `organization_id` + RLS policies in the same file
- pgTAP test: `supabase/tests/<noun>_rls.sql`
- Types refresh: wait for `sync-types.yml` cron OR run `pnpm db:types` locally; until then, cast with `as never` and add `TODO(types)` comment
- Seed: extend `supabase/seed.sql` and `supabase/seed.demo.sql` if relevant for demo accounts

**New Server Action:**
- If module already has `actions/`: add to existing operation file or create `actions/<verb>.ts` + add export to `actions/index.ts`
- If module has flat `actions.ts` and is < 300 lines: append there
- Always: `'use server'` at top, zod parse args, `getAuthContext` for auth, return `ActionState`, `revalidatePath` on success

**New shadcn primitive:**
- File: `apps/web/src/components/ui/<primitive>.tsx`
- Do not modify (CLAUDE.md § 5) — wrap if customization needed

**New cross-cutting helper:**
- File: `apps/web/src/lib/<helper>.ts` (no React) or `apps/web/src/lib/<helper>.tsx` (with React)
- Subdirectory if growing (`lib/supabase/`, `lib/auth/`)

**New E2E test:**
- Smoke (canary cross-phase): extend `apps/web/tests/smoke/preview.spec.ts` only if global concern
- Phase golden path: `apps/web/tests/e2e/<feature>.spec.ts`
- Admin/Public/Portail: respective `apps/web/tests/{admin,public,portail}/<feature>.spec.ts`

## Special Directories

**`packages/database/src/types.gen.ts`:**
- Purpose: Auto-generated Supabase types
- Generated: Yes (`pnpm db:types` or nightly cron `sync-types.yml`)
- Committed: Yes (committed but never edited by hand)

**`.planning/`:**
- Purpose: Working memory across sessions (phase plans, intel, codebase maps)
- Generated: Mixed (codebase/ is generated; phases/, intel/ are hand-written)
- Committed: Yes

**`docs/showcase/`:**
- Purpose: Phase deliverables (screenshots/GIFs/MP4) per CLAUDE.md § 13.5
- Generated: No (manually captured during phase validation)
- Committed: Yes (PNG ≤ 500 KB, MP4/GIF ≤ 5 MB)

**`supabase/.temp/`, `apps/web/.next/`, `node_modules/`, `.turbo/`:**
- Generated: Yes
- Committed: No (gitignored)

**`.env`, `.env.local`:**
- Purpose: Secrets (Supabase URL/anon key, NIR keys, JWT secret)
- Generated: No (created by `setup-vercel.yml` for CI; local copy from `.env.example`)
- Committed: No — never read these files contents

---

*Structure analysis: 2026-05-12*
