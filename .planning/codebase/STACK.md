# Technology Stack

**Analysis Date:** 2026-05-12

## Languages

**Primary:**
- TypeScript 5.5.4 — strict mode partout (`strict: true`, `noUncheckedIndexedAccess: true`), tout le code applicatif `apps/web/src/**` et `packages/**/src/**`
- SQL (PostgreSQL 15) — 16 migrations dans `supabase/migrations/` (foundations, RLS, patients, rides, drivers, vehicles, legal/RGPD)
- TypeScript ciblant Deno — Edge Function NIR `supabase/functions/nir/index.ts` + `_shared/crypto.ts`

**Secondary:**
- MDX — pages légales publiques sous `apps/web/src/content/legal/*.md` (chargées via `next-mdx-remote/rsc`)
- Shell — scripts de bootstrap `scripts/build-setup-sql.sh`, `scripts/setup-vercel-env.sh`

**Non détectés (réservés pour passes futures) :**
- Python (microservice OR-Tools) — prévu `services/optimizer/` mais répertoire `services/` absent à ce jour
- Swift/Kotlin — pas d'app native ; PWA chauffeur prévue dans `apps/mobile/` (non créée)

## Runtime

**Environment:**
- Node.js >= 20 (cf. `package.json` `engines.node: ">=20"`)
- Deno (Edge Functions Supabase) — `std@0.224.0` via `supabase/functions/deno.json`
- Vercel runtime Node (région `cdg1`, cf. `vercel.json`)
- PostgreSQL 15 (cf. `supabase/config.toml` `major_version = 15`)

**Package Manager:**
- pnpm 9.12.0 (déclaré `packageManager` racine `package.json`)
- Lockfile : `pnpm-lock.yaml` présent et `--frozen-lockfile` imposé en CI
- Workspaces : `apps/*`, `packages/*`, `services/*` (cf. `pnpm-workspace.yaml`)

## Frameworks

**Core:**
- Next.js 14.2.13 — App Router uniquement (`apps/web/`), Server Components par défaut, Server Actions pour les mutations
- React 18.3.1 + React DOM 18.3.1
- Turborepo 2.1.0 — pipeline build/lint/typecheck/test/test:e2e (cf. `turbo.json`)

**Testing:**
- Vitest 2.0.5 — tests unitaires métier (`packages/shared/vitest.config.ts`)
- Playwright 1.47 — E2E (`apps/web/playwright.config.ts`, `testMatch: ['e2e/**/*.spec.ts', 'tests/**/*.spec.ts']`)
- pgTAP — tests RLS dans `supabase/tests/*.sql` (16 fichiers : RLS, transitions, anonymize, breach deadlines)
- Deno test — tests de l'Edge Function NIR (`supabase/functions/nir/index.test.ts`)

**UI:**
- Tailwind CSS 3.4.10 + `tailwindcss-animate` 1.0.7 + `prettier-plugin-tailwindcss`
- shadcn/ui (config `apps/web/components.json`, style "default", baseColor "slate", CSS variables HSL)
- Radix UI primitives : `@radix-ui/react-dialog`, `react-dropdown-menu`, `react-label`, `react-slot`
- Lucide React 0.439 — icônes (famille unique imposée par CLAUDE.md § 1)
- `class-variance-authority` 0.7 + `clsx` 2.1.1 + `tailwind-merge` 2.5.2 — composition de classes
- `sonner` 1.5 — toasts

**Build/Dev:**
- Turborepo (cache local) — orchestration `pnpm dev/build/test`
- PostCSS 8.4.45 + Autoprefixer 10.4.20 (cf. `apps/web/postcss.config.mjs`)
- Prettier 3.3.3 — config racine `.prettierrc` (semi, singleQuote, trailingComma all, printWidth 100, tabWidth 2)
- `concurrently` 9 — lance Next dev + `supabase functions serve nir` en parallèle pendant les tests Playwright

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` ^2.45.4 — client de base (toutes les apps + packages)
- `@supabase/ssr` ^0.5.1 — wrapper SSR cookies (`packages/database/src/client-browser.ts`, `client-server.ts`, `middleware-client.ts`)
- `@tanstack/react-query` ^5.56 + devtools — fetch côté client dans `apps/web`
- `zod` ^3.23.8 — validation runtime ; tous les validators centralisés dans `packages/shared/src/validators/` (`patient.ts`, `ride.ts`, `driver.ts`, `vehicle.ts`, `legal.ts`, `patient-constraint.ts`, `patient-note.ts`, `common.ts`)
- `react-hook-form` ^7.53 + `@hookform/resolvers` ^3.9 — formulaires avec `zodResolver`
- `jose` ^6.2.3 — signature/vérification JWT HS256 du portail patient RGPD (`packages/shared/src/utils/legal-token.ts`)
- `chrono-node` 2.9.1 — parsing date libre français (`packages/shared/src/utils/parse-freeform-date.ts`)
- `@react-pdf/renderer` 4.5.1 — génération PDF registre RGPD (`apps/web/src/app/api/admin/legal/registre/pdf/route.tsx`, runtime `nodejs`)
- `pg` ^8.13 + `@types/pg` — utilisé uniquement par la page d'amorçage `/setup` (`apps/web/src/app/setup/actions.ts`) pour appliquer le SQL via `Client` direct ; **PAS** un client de prod
- `gray-matter` 4.0.3 + `next-mdx-remote` 6.0.0 — chargement des pages légales MDX

**Infrastructure:**
- `turbo` 2.1.0 — orchestrateur monorepo
- `husky` (via `prepare` script, dossier `.husky/` vide) — non utilisé activement
- `@types/node` ^20.14
- `@types/react` ^18.3.5, `@types/react-dom` ^18.3.0

## Configuration

**Environment:**
- Fichier modèle : `.env.example` (racine) + `apps/web/.env.local.example`
- En production : injection 100 % automatisée via `.github/workflows/setup-vercel.yml` (workflow_dispatch idempotent qui pousse 8 env vars dans Vercel API + 2 secrets NIR dans Supabase Edge Functions)
- Variables critiques exposées au runtime (cf. `turbo.json` `globalEnv`) :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- App secrets serveur-only (non préfixés `NEXT_PUBLIC_`) :
  - `APP_NIR_ENCRYPTION_KEY` — clé AES-256-GCM 32 bytes base64 (stockée AUSSI dans Supabase secrets pour Edge Function)
  - `APP_NIR_SEARCH_KEY` — clé HMAC-SHA256 32 bytes base64
  - `APP_LEGAL_TOKEN_SECRET` — secret HS256 JWT portail patient
  - `APP_ANONYMIZATION_SALT` — salt RGPD anonymisation (`packages/shared/src/utils/patient-anonymize.ts`)
  - `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` — flag affichage comptes démo en preview/staging UNIQUEMENT
- Edge Function NIR lit les clés via `Deno.env.get('APP_NIR_ENCRYPTION_KEY' | 'APP_NIR_SEARCH_KEY')` (fail-fast au démarrage)

**Build:**
- Racine : `turbo.json` (tasks build/dev/lint/typecheck/test/test:e2e/clean)
- Web : `apps/web/next.config.mjs` (`reactStrictMode: true`, `transpilePackages: ['@tap/database', '@tap/shared']`)
- TS partagé : `tsconfig.base.json` (target ES2022, module ESNext, moduleResolution Bundler)
- Web TS : `apps/web/tsconfig.json` (paths `@/* → ./src/*`, plugin `next`)
- Vercel : `vercel.json` (framework nextjs, region `cdg1`, ignoreCommand qui bloque les builds non-`main`)

## Platform Requirements

**Development:**
- Node 20+, pnpm 9+
- Supabase CLI (pour `pnpm db:start`, `db:reset`, `db:diff`, `db:test`, `db:types`, `db:push`)
- Docker (requis par `supabase start` pour la stack locale ; signalé "sandbox-bloqué" dans certains SUMMARY antérieurs à Phase 0.7)
- Optionnel : Vercel CLI pour preview locale

**Production:**
- Vercel (région `cdg1` Paris) — hébergement Next.js
- Supabase Cloud — Postgres + Auth + Realtime + Storage + Edge Functions + Studio
- GitHub Actions — CI (`.github/workflows/ci.yml`) + CD auto sur push `main` (`cd.yml` : `supabase db push` → seed → `supabase functions deploy nir` → `vercel deploy --prod`)
- Preview Vercel automatique sur chaque PR + smoke Playwright via `preview-smoke.yml` (event `deployment_status`)

**Régions :**
- Vercel : `cdg1` (Paris) — cf. `vercel.json`
- Supabase : région dynamique récupérée via API (`aws-0-${region}.pooler.supabase.com`, port 5432, Supavisor session mode pour les seeds depuis runners GitHub Actions sans IPv6)

---

*Stack analysis: 2026-05-12*
