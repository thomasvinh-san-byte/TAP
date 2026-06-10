# Technology Stack

**Analysis Date:** 2026-06-10
**Last updated:** 2026-06-10

## Languages

**Primary:**
- TypeScript ~5.5.4 — strict mode partout (`strict: true`, `noUncheckedIndexedAccess`), tout `apps/web/src/**` et `packages/**/src/**`
- SQL (PostgreSQL 15) — 46 migrations dans `supabase/migrations/` (foundations, RLS, patients, rides, drivers, vehicles, légal/RGPD, récurrences, SMS, tarifs, positions chauffeur, conformité, messagerie interne)
- TypeScript ciblant Deno — Edge Function NIR `supabase/functions/nir/index.ts` + `_shared/crypto.ts`

**Secondary:**
- MDX / Markdown — pages légales publiques `apps/web/src/content/legal/*.md` (via `next-mdx-remote/rsc` + `gray-matter`)
- Shell — scripts de bootstrap sous `scripts/`

**Non détectés (réservés / abandonnés) :**
- Python (microservice OR-Tools) — **abandonné** (ADR-010). Le solveur est désormais une heuristique TS native dans `apps/web/src/lib/optimizer/` (`solve-local.ts`, `haversine.ts`). Le répertoire `services/` n'existe plus ; `packages/optimizer-client/src/client.ts` est vidé (`export {}`) en attendant suppression.
- Swift/Kotlin — pas d'app native. La PWA chauffeur vit dans `apps/web/src/app/(driver)/` (Serwist service worker), pas dans une app séparée.

## Runtime

**Environment:**
- Node.js >= 20 (`package.json` `engines.node`)
- Deno (Edge Functions Supabase) — `supabase/functions/deno.json` + `import_map.json`
- Vercel runtime Node (région `cdg1`, cf. `vercel.json`)
- PostgreSQL 15 (`supabase/config.toml` `major_version = 15`)
- Service worker navigateur (Serwist 9) — `apps/web/src/sw.ts` compilé en `apps/web/public/sw.js`

**Package Manager:**
- pnpm 9.12.0 (`packageManager` racine)
- Lockfile : `pnpm-lock.yaml` présent, `--frozen-lockfile` en CI
- Workspaces (`pnpm-workspace.yaml`) : `apps/*`, `packages/*`, `services/*` (le glob `services/*` reste déclaré mais ne matche rien)

## Frameworks

**Core:**
- Next.js 15.5.x — App Router uniquement (`apps/web/`), Server Components par défaut, Server Actions pour les mutations. Version pinnée via override racine `next: 15.5.19`.
- React 18.3.1 + React DOM 18.3.1 (overrides racine — React 18, pas 19)
- Turborepo ^2.1.0 — pipeline build/dev/lint/typecheck/test/test:e2e + tâche `tokens:build` (`turbo.json`)

**Testing:**
- Vitest ^2.1.9 (+ `@vitest/coverage-v8`) — unitaires métier (`packages/pricing`, `packages/recurrence`, `packages/sms`, `packages/optimizer-client`, utils `packages/shared`) + tests composants ciblés `apps/web` (jsdom + Testing Library)
- Playwright ^1.47 — E2E + smoke (`apps/web/playwright.config.ts`)
- pgTAP — tests RLS `supabase/tests/*.sql` (35 fichiers)
- Deno test — Edge Function NIR (`supabase/functions/nir/index.test.ts`)

**UI:**
- Tailwind CSS ^3.4.10 + `tailwindcss-animate` + `prettier-plugin-tailwindcss`
- Tokens design system générés par Style Dictionary 4 (`apps/web/style-dictionary.config.mjs`, tâche turbo `tokens:build` → `src/styles/tokens.generated.{css,ts}` à partir de `tokens.json` / `tokens.dark.json`)
- shadcn/ui (config `apps/web/components.json`) ; primitives maison sous `apps/web/src/components/ui/`
- Radix UI : `react-dialog`, `react-dropdown-menu`, `react-label`, `react-slot`
- Lucide React ^0.439 — icônes (famille unique)
- `class-variance-authority` ^0.7 + `clsx` ^2.1.1 + `tailwind-merge` ^2.5.2
- `sonner` ^1.5 — toasts
- `react-datepicker` ^7.5 — sélection date (champs FR)

**Cartographie & offline:**
- `maplibre-gl` ^4.7 + `pmtiles` ^3.2 — carte (`apps/web/src/components/map/map.client.tsx`), tuiles servies localement (`public/tiles/reunion.pmtiles`), fallback raster OSM
- `dexie` ^4 + `dexie-react-hooks` ^1 — IndexedDB / file de mutations offline chauffeur (`apps/web/src/lib/offline/`)
- `serwist` / `@serwist/next` / `@serwist/precaching` ^9 — service worker PWA (`apps/web/src/sw.ts`)

**Build/Dev:**
- Turborepo (cache local) — `pnpm dev/build/test`
- PostCSS ^8.4.45 + Autoprefixer ^10.4.20
- Prettier ^3.3.3 (`.prettierrc`)
- ESLint 9 — **flat config** (`eslint.config.mjs` racine, plus aucun `.eslintrc`), via `typescript-eslint` 8, `@next/eslint-plugin-next` 15, `eslint-plugin-react-hooks` 7. Règles bruyantes en `warn` pour CI verte (durcissement reporté).
- `concurrently` ^9 — Next dev + `supabase functions serve nir` pendant Playwright

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.45.4 + `@supabase/ssr` (via `@tap/database`) — accès données / auth
- `@tanstack/react-query` ^5.56 (+ devtools) — fetch client `apps/web`
- `zod` ^3.23.8 — validation runtime, validators centralisés `packages/shared/src/validators/`
- `react-hook-form` ^7.53 + `@hookform/resolvers` ^3.9 — formulaires (`zodResolver`)
- `jose` ^6.2.3 — JWT HS256 portail patient RGPD (`packages/shared/src/utils/legal-token.ts`)
- `date-fns` ^4.1 — manipulation dates (TZ `Indian/Reunion`)
- `@sentry/nextjs` ^8.42 — monitoring erreurs (désormais **intégré** : `apps/web/sentry.server.config.ts`, `sentry.edge.config.ts`, `src/lib/sentry/`, `src/app/global-error.tsx`)
- `@react-pdf/renderer` 4.5.1 — PDF (registre RGPD, récap chauffeurs, facturation)
- `next-mdx-remote` ^6 + `gray-matter` ^4 — pages légales
- `pg` ^8.13 — driver direct **uniquement** pour la page d'amorçage `/setup` (pas un client de prod)

**Packages workspace (tous présents et consommés par `apps/web`) :**
- `@tap/database` — types Supabase générés + factories client
- `@tap/shared` — zod + utils purs
- `@tap/pricing` — moteur tarification CGSS (`compute-cgss-short-trip.ts`)
- `@tap/recurrence` — génération occurrences (`generate-occurrences.ts`, `holidays-974.ts`, `rrule-helper.ts`)
- `@tap/sms` — consentement + rendu template + adaptateur Twilio (`twilio-adapter.ts`)
- `@tap/optimizer-client` — vestige HTTP (vidé, ADR-010)

**Infrastructure:**
- `turbo` ^2.1.0
- `style-dictionary` ^4 (tokens)
- `@types/node` ^20.14, `@types/react` 18.3.5, `@types/react-dom` 18.3.0, `@types/pg` ^8.11
- `husky` (via `prepare`, non actif)

## Configuration

**Environment:**
- Modèle : `.env.example` (racine) + `apps/web/.env.local.example`
- Production : injection automatisée via `.github/workflows/setup-vercel.yml`
- Variables runtime exposées (cf. `turbo.json` `globalEnv`, élargi) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CGU_VERSION`, `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS`, `SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_URL(_NON_POOLING)`, `APP_NIR_SEARCH_KEY`, `CRON_APP_TOKEN`, `TWILIO_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_*`, `VERCEL_ENV`, `GEOLOC_ENABLED`
- App secrets serveur-only : `APP_NIR_ENCRYPTION_KEY`, `APP_NIR_SEARCH_KEY`, `APP_LEGAL_TOKEN_SECRET`, `APP_ANONYMIZATION_SALT`
- `CRON_APP_TOKEN` — protège les Route Handlers cron SMS (`/api/cron/sms-reminders-*`)
- Edge Function NIR lit ses clés via `Deno.env.get(...)` (fail-fast)

**Build:**
- Racine : `turbo.json` (build/dev/lint/typecheck/test/test:e2e/clean + `tokens:build`)
- Web : `apps/web/next.config.mjs` (+ wrap Serwist + Sentry), build = `tokens:build` puis `next build`
- TS partagé : `tsconfig.base.json` (target ES2022, moduleResolution Bundler)
- ESLint : `eslint.config.mjs` (flat config, racine)
- Vercel : `vercel.json` (framework nextjs, région `cdg1`)

## Platform Requirements

**Development:**
- Node 20+, pnpm 9+
- Supabase CLI (`pnpm db:*`)
- Docker (stack Supabase locale)

**Production:**
- Vercel (`cdg1` Paris) — Next.js
- Supabase Cloud — Postgres + Auth + Realtime + Storage + Edge Functions + `pg_cron`/`pg_net` (migration `pg_net_pg_cron_setup`)
- GitHub Actions — CI (`ci.yml`) + CD auto sur `main` (`cd.yml`) + smoke preview + sync types

**Régions :**
- Vercel : `cdg1` (Paris)
- Supabase : région dynamique via API (pooler Supavisor session mode pour seeds CI)

---

*Stack analysis: 2026-06-10*
