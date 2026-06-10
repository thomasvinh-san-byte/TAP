<!-- refreshed: 2026-06-10 -->
# Architecture

**Analysis Date:** 2026-06-10
**Last updated:** 2026-06-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│            Browser (régulatrice / chauffeur / dirigeant)         │
│   React Client Components + TanStack Query + Realtime + Sonner   │
│   PWA chauffeur : Serwist SW + Dexie (IndexedDB, sync différée)  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS (cookies PKCE)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│         Next.js 15 App Router — `apps/web/src/app/`             │
├──────────────────────┬───────────────────────┬──────────────────┤
│ Régulateur (app)     │ Chauffeur (driver)    │ Admin (admin)    │
│ cockpit, courses,    │ /conduite (PWA)       │ chauffeurs,      │
│ patients, tableau-   │ offline-capable       │ vehicules,       │
│ de-bord              │                       │ tarifs, sms,     │
│                      │                       │ conformite,      │
│                      │                       │ facturation,     │
│                      │                       │ legal, maint.    │
├──────────────────────┴───────────────────────┴──────────────────┤
│  Server Components (RSC)        Server Actions ('use server')    │
│  `_lib/queries.ts`              `actions/*.ts` (barrel index.ts) │
│  Route Handlers (`api/*`)       optimizer / cron SMS / PDF / SW  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Middleware Auth PKCE
                               │ `apps/web/src/middleware.ts`
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│       Supabase wrappers `apps/web/src/lib/supabase/*`            │
│       `server.ts` (cookies) | `client.ts` (browser) | `admin.ts` │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + Realtime + Storage + Edge Functions)│
│  RLS systématique `organization_id` + audit triggers             │
│  pg_cron/pg_net | `supabase/migrations/*.sql` (46) | functions/nir│
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Anti-FOUC theme bootstrap, `<html lang="fr">` | `apps/web/src/app/layout.tsx` |
| Régulateur shell | App header, nav, DraftQueue, ride orchestrator, role guard | `apps/web/src/app/(app)/layout.tsx` |
| Chauffeur shell | PWA shell mobile-first, role guard `chauffeur` | `apps/web/src/app/(driver)/layout.tsx` |
| Admin shell | Dirigeant guard | `apps/web/src/app/(admin)/layout.tsx` |
| Auth middleware | PKCE refresh + redirects (welcome/setup/login) | `apps/web/src/middleware.ts` |
| Auth context | Single source of truth role + org_id | `apps/web/src/lib/auth/get-auth-context.ts` |
| Supabase server | Wraps `createServerClient` with `cookies()` | `apps/web/src/lib/supabase/server.ts` |
| Supabase admin | `service_role` client (Node-only) | `apps/web/src/lib/supabase/admin.ts` |
| Providers (client) | TanStack Query + Sonner toaster | `apps/web/src/app/(app)/providers.client.tsx` |
| Ride orchestrator | Multi-instance modal store (reducer + Context) | `apps/web/src/app/(app)/courses/_components/ride-express-orchestrator.client.tsx` |
| Cockpit temps réel | Realtime rides/alerts/positions chauffeur | `apps/web/src/app/(app)/cockpit/_lib/use-cockpit-*.ts` |
| Offline sync engine | File de mutations Dexie + rejeu différé | `apps/web/src/lib/offline/sync-engine.ts` |
| Optimizer | Heuristique tournées TS native (ADR-010) | `apps/web/src/lib/optimizer/solve-local.ts` |
| Database package | Generated types + Supabase client factories | `packages/database/src/index.ts` |
| Shared package | Zod validators + pure utils | `packages/shared/src/index.ts` |
| NIR Edge Function | encrypt/decrypt/hash NIR with forced audit | `supabase/functions/nir/index.ts` |

## Pattern Overview

**Overall:** Next.js App Router with **route-group-as-role** (`(app)` régulateur, `(driver)` chauffeur, `(admin)` dirigeant, `(auth)`, `(public)`) — each group owns a `layout.tsx` doing server-side role guard via `getAuthContext` (defense in depth on top of Postgres RLS). Backend is "Backend-as-a-Service" Supabase, accessed through typed wrappers — Route Handlers exist only for anonymous flows, PDF exports, driver write endpoints (idempotency), cron SMS, optimizer, and the NIR Edge Function.

**Key Characteristics:**
- **Server-first**: RSC pages prefetch via `queryClient.prefetchQuery` + `<HydrationBoundary>`; Client Components only when interactivity required (suffix `.client.tsx`)
- **Server Actions as the primary mutation channel**: barrels `actions/index.ts` re-export operation-split files (`create.ts`, `edit.ts`, `cancel.ts`, `assignment.ts`, `payment.ts`, `list.ts`) — each ≤ 300 lines
- **Realtime for live views**: cockpit régulateur subscribes to `postgres_changes` (rides, alerts, driver positions); messaging subscribes per ride
- **Offline-first driver PWA**: Serwist service worker + Dexie queue; mutations rejouées par `sync-engine.ts` au retour réseau
- **RLS-first authorization**: applicative role checks are *defense in depth* — Postgres policies are the truth
- **Strict per-file size limit**: ≤ 300 LOC files, ≤ 150 LOC components, ≤ 50 LOC functions

## Layers

**Route layer — `apps/web/src/app/`:**
- Purpose: App Router routing + role-scoped shells + Route Handlers
- Location: `app/(app|driver|admin|auth|public)/`, `app/api/`
- Depends on: `_lib/queries.ts`, `actions/`, `@/lib/*`
- Used by: middleware + the browser

**Server data access layer — co-located:**
- Purpose: typed RLS-protected reads (RSC) and mutations (Server Actions)
- Location: `app/**/queries.ts`, `app/**/_lib/queries.ts`, `app/**/actions/`
- Contains: `'server-only'` modules, Server Actions (`'use server'`)
- Depends on: `@/lib/supabase/server`, `@tap/database`, `@tap/shared`

**Cross-cutting lib layer — `apps/web/src/lib/`:**
- Purpose: framework-agnostic helpers (no routing)
- Location: `lib/{supabase,auth,geocoding,geoloc,offline,optimizer,pricing,recurrence,sms,pdf,pois,messaging,sentry,api,vehicles}/`
- Contains: Supabase wrappers, NIR client, BAN geocoding, Dexie offline engine, TS optimizer, Sentry scrubbing, idempotency/driver-auth helpers

**UI primitives & shared widgets — `apps/web/src/components/`:**
- Purpose: shadcn/ui primitives + reusable list/form/page scaffolding
- Location: `components/ui/`, `components/data-table/`, `components/form/`, `components/page-header/`, `components/map/`, `components/messaging/`
- Depends on: Radix UI + Tailwind tokens
- Used by: every feature `_components/*.client.tsx`

**Domain & validation layer — `packages/`:**
- Purpose: pure TS (no Supabase, no React) + typed clients
- Location: `packages/shared` (zod + utils), `packages/database` (types + factories), `packages/pricing`, `packages/recurrence`, `packages/sms`, `packages/optimizer-client` (vestige vidé)
- Used by: Server Actions + Client forms (`zodResolver`)

**Database & functions layer — `supabase/`:**
- Purpose: schema, RLS, audit triggers, pg_cron/pg_net, Edge Functions
- Location: `supabase/migrations/` (46), `supabase/functions/` (Deno NIR), `supabase/tests/` (35 pgTAP)

## Data Flow

### Primary Request Path — RSC list page

1. Browser GET `/courses` → middleware refreshes session (`apps/web/src/middleware.ts`)
2. `(app)/layout.tsx` runs `getAuthContext()` and may `redirect('/login' | '/conduite')`
3. `(app)/courses/page.tsx` instantiates a `QueryClient`, calls the enriched RSC fetch
4. `_lib/queries.ts` reads `rides` + joins via Supabase server client (RLS-filtered same-org)
5. `<HydrationBoundary state={dehydrate(queryClient)}>` ships state; list rehydrates on client; the shared `DataTable` + `ListToolbar`/`ListMeta`/`Pagination` (`components/data-table/`) render with tri/filtres/pagination à seuil

### Mutation Path — Server Action

1. Form `'use client'` calls e.g. `createRideAction({...})` (`(app)/courses/actions/create.ts`)
2. Server: zod parse via `rideExpressInputSchema` from `@tap/shared`
3. `getAuthContext()` returns `{ supabase, user, organization_id }`
4. INSERT `rides` with `organization_id` + `created_by` — RLS policy enforces role
5. Postgres trigger writes `audit_logs` + `ride_events` (no app code needed)
6. `revalidatePath` on affected routes (`/courses`, `/cockpit`)
7. Returns `ActionState = { error? | success?, id? }` — never throws

### Cockpit Realtime Flow

1. `(app)/cockpit/page.tsx` prefetches rides server-side
2. Client hooks `use-cockpit-rides.ts` / `use-cockpit-alerts.ts` / `use-driver-positions.ts` open Supabase Realtime channels (`postgres_changes`)
3. Incoming events invalidate/patch React Query cache → fade-in updates (no reload)
4. Driver positions (`driver_positions` table) render live on the MapLibre map

### Driver Offline Flow — `/conduite`

1. `(driver)/layout.tsx` guards role `chauffeur`; Serwist SW precaches shell
2. Reads resolve `drivers.id` via `profile_id = auth.uid()` then SELECT rides J/J+1 (`Indian/Reunion` TZ)
3. Start/end/no-show actions hit `POST /api/driver/rides/[rideId]/{start,end,no-show}` with idempotency keys; offline, they queue in Dexie (`lib/offline/`)
4. `network-listener.client.ts` detects reconnection → `sync-engine.ts` replays the queue

### Auth Bootstrap

1. Browser hits any path → `middleware.ts` checks env vars present
2. Missing env → redirect `/welcome`; env present but DB empty → `/setup`
3. No session + protected path → `/login?next=...`; session + on `/login` → redirect home

**State Management:**
- Server state: TanStack Query (`(app)/providers.client.tsx`, `refetchOnWindowFocus: false`)
- Realtime: Supabase channels patch the React Query cache
- Server cache invalidation: `revalidatePath` from Server Actions; `invalidateQueries` in Client Components after success
- Offline state: Dexie (IndexedDB) mutation queue + `use-sync-status.ts`
- Local UI state: `useState`/`useReducer` (ride orchestrator); Context only for orchestrator
- Theme: `<html data-theme>` anti-FOUC inline script, `localStorage`
- No Redux/Zustand/Jotai

## Key Abstractions

**`AuthContext`:** bundles `{ supabase, userId, organizationId, role, profile }`, single resolution per request, returns `null` (never throws) — `apps/web/src/lib/auth/get-auth-context.ts`

**`ActionState`:** uniform `{ error?; success?; id? }` for every mutation; never throw to UI; French messages

**`RideOrchestratorCtx`:** open/minimize/resume multiple ride drafts; reducer + Context mounted once in `(app)/layout.tsx`; global `Cmd/Ctrl+Shift+K` dispatches `OPEN_NEW`

**Shared list scaffolding (`components/data-table/`):** `DataTable` + `ListToolbar` + `ListMeta` + `Pagination` (seuil) — standard pour toute liste régulateur/admin > 20 items

**Shared form scaffolding (`components/form/`):** `form-layout.tsx` patron + `field.tsx`, `combobox.client.tsx`, `number-field.tsx`, `password-input.client.tsx` ; primitive mobile `components/ui/bottom-sheet.tsx`

**`patients_safe` view (NIR firewall):** SECURITY INVOKER view excluding `nir_encrypted`/`nir_search_hash`; exposes `nir_last4` + `has_nir`; NIR ciphertext NEVER leaves Postgres → Edge Function

**Offline sync engine:** Dexie schema (`lib/offline/dexie-schema.ts`) + queue replay (`sync-engine.ts`) for driver write actions

## Entry Points

**Browser entry — root layout:** `apps/web/src/app/layout.tsx` (anti-FOUC theme, French metadata)

**Middleware:** `apps/web/src/middleware.ts` (env gate, PKCE refresh, login redirects)

**Route Handlers (Node runtime):** `app/api/{legal/cookie-consent,admin/*/pdf,driver/rides/*,cron/sms-reminders-*,sms/webhook/twilio,optimizer}` — anonymous flows, PDF exports, driver writes, cron, Twilio webhook, optimizer

**Edge Function (Deno):** `supabase/functions/nir/index.ts` — NIR encrypt/decrypt/hash with forced audit on `decrypt`

**Service worker:** `apps/web/src/sw.ts` (Serwist) — PWA precache + offline shell

**Background workflows (GitHub Actions):** `.github/workflows/{cd,preview-smoke,sync-types,setup-vercel}.yml` + pg_cron SMS jobs

## Architectural Constraints

- **Multi-tenant by RLS**: every business table has `organization_id` + RLS referencing `current_organization_id()`. Never `service_role` in user-facing flows.
- **NIR ciphertext stays in Postgres**: only `patients_safe` view + NIR Edge Function touch `nir_encrypted`.
- **Defense-in-depth role check**: applicative role guard in driver actions/queries on top of RLS (avoids same-org cross-driver leak).
- **Server Actions never throw to UI**: always return `ActionState`; Postgres errors reformulated in French.
- **Sentry PII scrubbing**: all events pass `lib/sentry/scrub.ts` to strip NIR/health data before send.
- **Idempotency for driver writes**: `idempotency_keys` table + `lib/api/idempotency.ts` guard offline-replayed start/end/no-show.
- **RLS recursion guard**: helpers wrapped SECURITY DEFINER (hotfix migration `20260518000001`) — keep new RLS policies non-recursive.
- **Threading**: single-threaded Node (Vercel) + single-threaded Deno (Edge). No worker threads V1.
- **No global mutable state**: QueryClient is `useState(() => new QueryClient())` per tab — never module-level.
- **Generated types**: `packages/database/src/types.gen.ts` regenerated nightly (`sync-types.yml`). New columns may need `as never` casts until the cron lands.

## Anti-Patterns

### Business logic in React components
**What happens:** A `_components/*.client.tsx` does zod parsing, tariff calc, or Supabase queries directly.
**Why it's wrong:** Breaks RSC/Server Action contract, leaks `service_role` risk.
**Do this instead:** Push into `packages/*` or a Server Action under `actions/`. Tariff → `packages/pricing`; recurrence → `packages/recurrence`; SMS → `packages/sms`.

### Direct `@supabase/*` import in app code
**What happens:** A file creates its own Supabase client.
**Why it's wrong:** Bypasses cookie wiring, breaks RLS context, may use `service_role`.
**Do this instead:** Import from `@/lib/supabase/{server,client,admin}`.

### Reading raw `patients` table
**What happens:** `from('patients').select(...)` from app code.
**Why it's wrong:** Risks shipping `nir_encrypted` ciphertext to the browser.
**Do this instead:** `from('patients_safe').select(...)`.

### Throwing from Server Actions
**What happens:** Action `throw new Error(...)` surfaces a stack trace.
**Why it's wrong:** CLAUDE.md § 6 forbids stack traces in UI.
**Do this instead:** Return `ActionState` with a French message.

### Hand-rolling list UI / forms
**What happens:** A feature re-implements its own table header, pagination, or form layout.
**Why it's wrong:** Diverges from the design system and from tested widgets.
**Do this instead:** Use `components/data-table/` (`DataTable`/`ListToolbar`/`ListMeta`/`Pagination`) and `components/form/form-layout.tsx`.

### Files over 300 lines / components over 150
**Do this instead:** Split into a folder + barrel `index.ts` (e.g. `(app)/courses/actions/`).

## Error Handling

**Strategy:** Reformulate every error in French at the boundary; never throw to UI.

**Patterns:**
- Server Action: `try → return { error: 'message FR' }` (no rethrow)
- RSC query: throws French message → caught by route `error.tsx` (`(app)/error.tsx`, `(driver)/error.tsx`) or `global-error.tsx`
- Client form: zod via `react-hook-form` + `zodResolver`, errors under field
- Toast: `sonner` for success/failure (`providers.client.tsx`)
- Sentry captures unhandled errors (scrubbed)

## Cross-Cutting Concerns

**Logging:** No structured logger; `console.*` forbidden in commits. Audit trail = Postgres triggers → `audit_logs`. Sentry for exceptions.

**Validation:** zod schemas centralized in `packages/shared/src/validators/` (patient, patient-constraint, patient-note, ride, driver, vehicle, legal, common, ...). Re-validated client (`zodResolver`) and server (`safeParse`).

**Authentication:** Supabase Auth PKCE. Session refresh single source = `apps/web/src/middleware.ts`. Server reads via `auth.getUser()` (validated) — never `getSession()`.

**Authorization:** Three layers — route-group `layout.tsx` guard → Server Action explicit role check → Postgres RLS policies (non-negotiable).

---

*Architecture analysis: 2026-06-10*
