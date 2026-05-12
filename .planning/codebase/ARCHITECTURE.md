<!-- refreshed: 2026-05-12 -->
# Architecture

**Analysis Date:** 2026-05-12

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                Browser (régulatrice / chauffeur / dirigeant)     │
│         React Client Components + TanStack Query + Sonner        │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS (cookies PKCE)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         Next.js 14 App Router — `apps/web/src/app/`              │
├──────────────────────┬───────────────────────┬──────────────────┤
│ Régulateur (app)     │ Chauffeur (driver)    │ Admin (admin)    │
│ `(app)/layout.tsx`   │ `(driver)/layout.tsx` │ `(admin)/layout` │
│ patients, courses    │ /conduite             │ /admin/*         │
├──────────────────────┼───────────────────────┼──────────────────┤
│  Server Components (RSC)        Server Actions ('use server')    │
│  `_lib/queries.ts`              `actions/*.ts` (barrel index.ts) │
│  `queries.ts`                                                    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Middleware Auth PKCE
                               │ `apps/web/src/middleware.ts`
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│       Supabase wrappers `apps/web/src/lib/supabase/*`            │
│       `server.ts` (cookies) | `client.ts` (browser) | `admin.ts` │
│       (service_role API routes only)                             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + Storage + Edge Functions)           │
│  RLS systématique `organization_id` + audit triggers             │
│  `supabase/migrations/*.sql` | `supabase/functions/nir/`         │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Anti-FOUC theme bootstrap, `<html lang="fr">` | `apps/web/src/app/layout.tsx` |
| Régulateur shell | Header sticky, NavTabs, DraftQueue, orchestrator, role guard | `apps/web/src/app/(app)/layout.tsx` |
| Chauffeur shell | PWA shell mobile-first (max-w-[640px]), role guard `chauffeur` | `apps/web/src/app/(driver)/layout.tsx` |
| Admin shell | Dirigeant guard via direct `profiles.role` SELECT | `apps/web/src/app/(admin)/layout.tsx` |
| Auth middleware | PKCE refresh + redirects (welcome/setup/login) | `apps/web/src/middleware.ts` |
| Auth context | Single source of truth for role + org_id (RSC + actions) | `apps/web/src/lib/auth/get-auth-context.ts` |
| Supabase server | Wraps `createServerClient` with `cookies()` | `apps/web/src/lib/supabase/server.ts` |
| Supabase admin | `service_role` client (Node-only API routes) | `apps/web/src/lib/supabase/admin.ts` |
| Providers (client) | TanStack Query + Sonner toaster | `apps/web/src/app/(app)/providers.client.tsx` |
| Ride orchestrator | Multi-instance modal store via reducer + Context | `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` |
| Database package | Generated types + Supabase client factories | `packages/database/src/index.ts` |
| Shared package | Zod validators + pure utils (anonymize, parse-date) | `packages/shared/src/index.ts` |
| NIR Edge Function | encrypt/decrypt/hash NIR with forced audit | `supabase/functions/nir/index.ts` |

## Pattern Overview

**Overall:** Next.js App Router with **route-group-as-role** (`(app)` régulateur, `(driver)` chauffeur, `(admin)` dirigeant, `(auth)`, `(public)`) — each group owns a `layout.tsx` doing server-side role guard via `getAuthContext` (defense in depth on top of Postgres RLS). Backend is "Backend-as-a-Service" Supabase, accessed through typed wrappers — no custom Node API layer except thin Route Handlers for anonymous flows and the NIR Edge Function.

**Key Characteristics:**
- **Server-first**: RSC pages prefetch via `queryClient.prefetchQuery` + `<HydrationBoundary>`; Client Components only when state/interactivity required (file suffix `.client.tsx` convention)
- **Server Actions as the only mutation channel**: barrel `actions/index.ts` re-exports operation-split files (`create.ts`, `edit.ts`, `cancel.ts`, `assignment.ts`, `payment.ts`, `list.ts`) — each ≤ 300 lines per CLAUDE.md § 11
- **Co-located queries**: `queries.ts` (small modules) or `_lib/queries.ts` (large modules with split into `queries.ts` + `queries-enriched.ts`)
- **RLS-first authorization**: applicative role checks are *defense in depth* — Postgres policies are the truth
- **Strict per-file size limit**: ≤ 300 LOC files, ≤ 150 LOC components, ≤ 50 LOC functions

## Layers

**Route layer — `apps/web/src/app/`:**
- Purpose: Next.js App Router routing + role-scoped shells
- Location: `apps/web/src/app/(app|driver|admin|auth|public)/`
- Contains: `layout.tsx`, `page.tsx`, route groups
- Depends on: `_lib/queries.ts`, `actions/`, `@/lib/supabase`, `@/lib/auth`
- Used by: middleware + the browser

**Server data access layer — co-located:**
- Purpose: typed RLS-protected reads (RSC) and mutations (Server Actions)
- Location: `apps/web/src/app/**/queries.ts`, `apps/web/src/app/**/_lib/queries.ts`, `apps/web/src/app/**/actions/`
- Contains: `'server-only'` modules, Server Actions (`'use server'`)
- Depends on: `@/lib/supabase/server`, `@tap/database`, `@tap/shared` (zod)
- Used by: RSC pages and Client Components (Server Actions only)

**UI primitives layer — `apps/web/src/components/`:**
- Purpose: shadcn/ui primitives + cross-cutting widgets
- Location: `apps/web/src/components/ui/` + `apps/web/src/components/`
- Contains: button, dialog, sheet, dropdown-menu, badge, sonner, etc.
- Depends on: Radix UI + Tailwind tokens
- Used by: every feature `_components/*.client.tsx`

**Domain & validation layer — `packages/`:**
- Purpose: pure TS (no Supabase, no React)
- Location: `packages/shared/src/validators/`, `packages/shared/src/utils/`, `packages/database/src/`
- Contains: zod schemas (patient, ride, vehicle, driver, legal), date parser, anonymizer, legal token signer, generated types
- Depends on: zod, jose
- Used by: Server Actions + Client forms (via `zodResolver`)

**Database & functions layer — `supabase/`:**
- Purpose: schema, RLS, audit triggers, Edge Functions
- Location: `supabase/migrations/`, `supabase/functions/`, `supabase/tests/` (pgTAP)
- Contains: 16 migrations, NIR Edge Function (Deno), pgTAP RLS suites

## Data Flow

### Primary Request Path — RSC list page

1. Browser GET `/courses` → middleware refreshes session (`apps/web/src/middleware.ts`)
2. `(app)/layout.tsx` runs `getAuthContext()` and may `redirect('/login' | '/conduite')`
3. `(app)/courses/page.tsx:21` instantiates a `QueryClient`, calls `listRidesEnriched({})` (RSC fetch)
4. `_lib/queries-enriched.ts` reads `rides` + joins via Supabase server client (RLS-filtered same-org)
5. `<HydrationBoundary state={dehydrate(queryClient)}>` ships state; `<RidesList />` rehydrates on client (`apps/web/src/app/(app)/courses/_components/rides-list.client.tsx`)

### Mutation Path — Server Action

1. Form `'use client'` calls e.g. `createRideAction({...})` (`apps/web/src/app/(app)/courses/actions/create.ts:29`)
2. Server: zod parse via `rideExpressInputSchema` from `@tap/shared`
3. `getAuthContext()` returns `{ supabase, user, organization_id }` (`actions/_shared.ts:39`)
4. INSERT `rides` with `organization_id` + `created_by` — RLS policy `rides_insert_regulateur` enforces role
5. Postgres trigger `rides_audit_trigger` writes `audit_logs` (no app code needed)
6. Optional cleanup (DELETE `ride_draft`) + `revalidatePath('/courses')` + `revalidatePath('/cockpit')`
7. Returns `ActionState = { error? | success?, id? }` — never throws

### Driver Flow — `/conduite`

1. `(driver)/layout.tsx` guards role `chauffeur`
2. `(driver)/conduite/_lib/queries.ts:213` `listMyRidesUpcoming()` resolves `drivers.id` via `profile_id = auth.uid()` then SELECTs rides J+J+1 in `Indian/Reunion` TZ
3. `(driver)/conduite/actions.ts` exposes `startRideAction`, `endRideAction`, payment actions — each verifies role + `driver_id` ownership applicatively

### Auth Bootstrap

1. Browser hits any path → `middleware.ts:17` checks env vars present
2. Missing env → redirect `/welcome` (config helper page)
3. Env present, DB empty → `/setup` (admin init via `apps/web/src/app/setup/actions.ts`)
4. No session + protected path → redirect `/login?next=...`
5. Session + on `/login` → redirect `/patients`

**State Management:**
- Server state: TanStack Query (configured in `apps/web/src/app/(app)/providers.client.tsx`, `staleTime: 30_000`, `refetchOnWindowFocus: false`)
- Server cache invalidation: `revalidatePath` from Server Actions; `useQueryClient().invalidateQueries` in Client Components after Server Action success
- Local UI state: `useState` / `useReducer` (e.g. ride orchestrator)
- Cross-component coordination: React Context — currently only `RideOrchestratorProvider`
- Theme: `<html data-theme>` set by inline anti-FOUC script in `layout.tsx`, persisted in `localStorage`
- No Redux, no Zustand, no Jotai

## Key Abstractions

**`AuthContext` (auth resolution):**
- Purpose: bundles `{ supabase, userId, organizationId, role, profile }` — single resolution per request
- Examples: `apps/web/src/lib/auth/get-auth-context.ts:36`
- Pattern: lazy, returns `null` (never throws) — caller decides redirect vs error state

**`ActionState` (Server Action return shape):**
- Purpose: uniform `{ error?: string; success?: boolean; id?: string }` for every mutation
- Examples: `apps/web/src/app/(app)/courses/actions/_shared.ts:24`, `apps/web/src/app/(driver)/conduite/actions.ts:29`
- Pattern: never throw to UI; messages already reformulated in French

**`RideOrchestratorCtx` (multi-instance modal store):**
- Purpose: open/minimize/resume multiple ride drafts; only one visible at a time
- Examples: `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx:103` (reducer), `ride-orchestrator-context.client.tsx:48` (context)
- Pattern: reducer + Context mounted once in `(app)/layout.tsx`; global shortcut `Cmd/Ctrl+Shift+K` dispatches `OPEN_NEW`

**`Sheet` drawers (fixed width contract):**
- Purpose: drawer overlay used for patient & ride detail
- Examples: `apps/web/src/app/(app)/patients/_components/patient-drawer.client.tsx:48` (`w-[400px] sm:max-w-[400px]`), `apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx` (480px)
- Pattern: width verified by Playwright `boundingBox.width === 400 | 480` — do not change without updating tests

**`patients_safe` view (NIR firewall):**
- Purpose: SECURITY INVOKER view excluding `nir_encrypted` / `nir_search_hash`; exposes only `nir_last4` + `has_nir`
- Examples: every read in `apps/web/src/app/(app)/patients/queries.ts`, `apps/web/src/app/(driver)/conduite/_lib/queries.ts:154`
- Pattern: NIR ciphertext NEVER leaves Postgres → Edge Function

## Entry Points

**Browser entry — Next.js root layout:**
- Location: `apps/web/src/app/layout.tsx`
- Triggers: every HTTP request
- Responsibilities: anti-FOUC `data-theme` script, French metadata, single `<body>` slot

**Middleware:**
- Location: `apps/web/src/middleware.ts`
- Triggers: every request matching `/((?!_next/static|_next/image|favicon.ico|api/health).*)`
- Responsibilities: env-var gate → `/welcome`, session refresh via PKCE, redirect unauthenticated to `/login`, redirect authenticated away from `/login`

**API Routes (Node runtime):**
- Location: `apps/web/src/app/api/legal/cookie-consent/route.ts`, `apps/web/src/app/api/admin/legal/registre/pdf/route.ts`
- Triggers: anonymous POST (cookie consent), admin PDF export
- Responsibilities: `service_role` insert (cookie consent) — never used elsewhere

**Edge Function (Deno):**
- Location: `supabase/functions/nir/index.ts`
- Triggers: POST from server-side code (JWT-authenticated)
- Responsibilities: NIR encrypt / decrypt / hash with forced audit on `decrypt`

**Background workflows (GitHub Actions):**
- Location: `.github/workflows/cd.yml`, `preview-smoke.yml`, `sync-types.yml`, `setup-vercel.yml`
- Triggers: push main, deployment_status, cron 3h UTC
- Responsibilities: `supabase db push`, seed, Vercel deploy, Playwright preview smoke, regen `packages/database/src/types.gen.ts`

## Architectural Constraints

- **Multi-tenant by RLS**: every business table has `organization_id` column + RLS policy referencing `current_organization_id()`. Never SELECT without RLS active. Never use `service_role` in user-facing flows.
- **NIR ciphertext stays in Postgres**: only `patients_safe` view + NIR Edge Function ever touch `nir_encrypted`. App code (RSC + actions) MUST go through the view.
- **Defense-in-depth role check**: applicative `if (ctx.role !== 'chauffeur')` in driver actions/queries even though RLS would catch it — explicit short-circuit to avoid silent same-org leak between roles (a chauffeur can be `same-org` with another driver but must not see their rides).
- **Two distinct `getAuthContext` flavors**: full `@/lib/auth/get-auth-context.ts` (loads role + profile, used by guards & driver actions); minimal `apps/web/src/app/(app)/courses/actions/_shared.ts:39` (only `organization_id`, used by Phase 2 ride actions where RLS handles role gating). Pick the right one per use case.
- **Server Actions never throw to UI**: always return `ActionState`. Postgres errors are reformulated in French.
- **Threading**: single-threaded Node (Vercel functions) and single-threaded Deno (Edge Functions). No worker threads in scope V1.
- **No global mutable state**: TanStack QueryClient is `useState(() => new QueryClient(...))` per browser tab — never module-level.
- **Generated types lag**: `packages/database/src/types.gen.ts` is regenerated nightly by `sync-types.yml`. New columns/tables (drivers, vehicles, payment_*) need `as never` casts until the cron lands — TODOs annotated in queries.

## Anti-Patterns

### Business logic in React components

**What happens:** A `_components/*.client.tsx` performs zod parsing, tariff calculation, or Supabase queries directly.
**Why it's wrong:** Breaks RSC/Server Action contract, leaks `service_role` risk, prevents reuse across Phase 4 PWA.
**Do this instead:** Push logic into `packages/shared/src/utils` or a Server Action under `actions/`. Reference: `apps/web/src/app/(app)/courses/actions/create.ts:29` keeps zod + INSERT server-side; the form just calls it.

### Direct `@supabase/*` import in app code

**What happens:** A file imports `@supabase/supabase-js` and creates its own client.
**Why it's wrong:** Bypasses cookie wiring, breaks RLS context, may accidentally use `service_role`.
**Do this instead:** Always import from `@/lib/supabase/server` (RSC + actions), `@/lib/supabase/client` (browser), or `@/lib/supabase/admin` (Node API only). See `apps/web/src/lib/supabase/server.ts`.

### Reading raw `patients` table

**What happens:** `from('patients').select(...)` from app code.
**Why it's wrong:** Risks shipping `nir_encrypted` / `nir_search_hash` ciphertext to the browser.
**Do this instead:** `from('patients_safe').select(...)`. Reference: `apps/web/src/app/(app)/patients/queries.ts:64`.

### Throwing from Server Actions

**What happens:** Action `throw new Error('...')` bubbles up as a stack trace in the UI.
**Why it's wrong:** CLAUDE.md § 6 forbids stack traces / brut Postgres errors in UI.
**Do this instead:** Return `ActionState` with French message. Reference: `apps/web/src/app/(app)/courses/actions/create.ts:52` (`return { error: 'Création course impossible.' }`).

### Bypassing the orchestrator for ride creation

**What happens:** A component renders `<RideExpressModal>` directly.
**Why it's wrong:** Loses multi-instance reducer logic (minimize/resume) and Cmd+Shift+K wiring.
**Do this instead:** `useRideOrchestrator()` hook + `dispatch({ type: 'OPEN_NEW' | 'OPEN_EDIT', ... })`. Reference: `apps/web/src/app/(app)/courses/_components/ride-orchestrator-context.client.tsx:63`.

### Files over 300 lines / components over 150

**What happens:** Single `actions.ts` mixes create/edit/cancel/assign/payment.
**Why it's wrong:** CLAUDE.md § 11.
**Do this instead:** Split into a folder + barrel `index.ts`. Reference: `apps/web/src/app/(app)/courses/actions/` (8 files, all ≤ 140 LOC, barrelled at `actions/index.ts:18`).

## Error Handling

**Strategy:** Reformulate every error in French at the boundary; never throw to UI.

**Patterns:**
- Server Action: `try → return { error: 'message FR' }` (no rethrow)
- RSC query: `if (error) throw new Error('Lecture X impossible.')` — caught by Next.js error.tsx (none defined yet → default Next error page, currently acceptable pre-Passe 4)
- Client form: zod via `react-hook-form` + `zodResolver`, errors shown under field
- Toast: `sonner` for action success/failure (mounted in `providers.client.tsx`)

## Cross-Cutting Concerns

**Logging:** No structured logger yet. `console.*` forbidden in commits (CLAUDE.md § 11). Audit trail relies on Postgres triggers writing to `audit_logs`.

**Validation:** zod schemas centralized in `packages/shared/src/validators/`:
- `patient.ts`, `patient-constraint.ts`, `patient-note.ts`
- `ride.ts` (incl. `rideExpressInputSchema`, `rideDraftSchema`)
- `driver.ts`, `vehicle.ts`
- `legal.ts`, `common.ts`

Both client (`zodResolver`) and server (`schema.safeParse(args)` in actions) re-validate.

**Authentication:** Supabase Auth PKCE flow. Single source of session refresh = `apps/web/src/middleware.ts`. Server reads via `supabase.auth.getUser()` (validates with Auth server) — never `getSession()` (just reads cookie, untrusted).

**Authorization:** Three-layer:
1. Route-group `layout.tsx` role guard (redirect)
2. Server Action explicit role check (`getAuthContext` + `if (ctx.role !== ...)`)
3. Postgres RLS policies (`rides_insert_regulateur`, `drivers_select_same_org`, etc.) — non-negotiable

---

*Architecture analysis: 2026-05-12*
