# External Integrations

**Analysis Date:** 2026-05-12

## APIs & External Services

**Plateforme Supabase (BaaS principal) :**
- Supabase Cloud — Postgres + Auth + Realtime + Storage + Edge Functions
  - SDK : `@supabase/supabase-js` ^2.45.4 + `@supabase/ssr` ^0.5.1
  - URL : `NEXT_PUBLIC_SUPABASE_URL`
  - Auth client (anon) : `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Auth admin (bypass RLS, serveur uniquement) : `SUPABASE_SERVICE_ROLE_KEY` (cf. `apps/web/src/lib/supabase/admin.ts`)
  - Project ref / access token (CI/CD only) : `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- Supabase Management API — appelée par `.github/workflows/setup-vercel.yml` pour : récupérer la région du projet, lire l'anon key/service_role, pousser les secrets `APP_NIR_*` dans le secret store des Edge Functions
- Supabase Edge Functions (Deno runtime) — déployées via `supabase functions deploy nir` dans `.github/workflows/cd.yml`
  - Function `nir` — dispatcher HTTP `encrypt | decrypt | hash` (`supabase/functions/nir/index.ts`)
  - Function `_shared` — helpers CORS communs (`supabase/functions/_shared/cors.ts`)

**Vercel (hébergement front) :**
- Vercel API — utilisée par `setup-vercel.yml` pour push 8 env vars (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_NIR_*`, `APP_LEGAL_TOKEN_SECRET`, `APP_ANONYMIZATION_SALT`, `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS`) puis trigger redeploy
- Auth : `VERCEL_TOKEN` (account token)
- Identifiants projet : `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- Région exécution : `cdg1` (Paris) déclarée dans `vercel.json`

**À venir (déclarées dans `.env.example`, non encore intégrées) :**
- Twilio ou OVH SMS Pro — variables `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` ; aucun import SDK trouvé dans le code, package futur `packages/sms/` non créé
- OSRM auto-hébergé (routing GPS) — `OSRM_BASE_URL`, aucun consommateur dans le code
- Microservice optimizer (Python OR-Tools) — `OPTIMIZER_BASE_URL`, aucun consommateur, package futur `packages/optimizer-client/` non créé
- Web Push API (VAPID) — non encore intégrée

## Data Storage

**Databases:**
- PostgreSQL 15 hébergé sur Supabase Cloud (single tenant DB, multi-tenant logique par `organization_id` + RLS forcée — cf. ADR-002 `docs/adr/ADR-002-supabase-rls-multitenant.md`)
- Connexion : SDK Supabase exclusivement côté app ; `pg` ^8.13 (driver direct) utilisé uniquement par la page d'amorçage `/setup` (`apps/web/src/app/setup/actions.ts`) qui lit `POSTGRES_URL_NON_POOLING`/`POSTGRES_URL` pour exécuter le SQL d'installation initiale
- 16 migrations Supabase :
  - `20260506000001_foundations.sql` (organisations, profiles, audit_logs, extensions uuid-ossp/pgcrypto/citext)
  - `20260506000002_rls_foundations.sql` (RLS + helpers SECURITY DEFINER `current_organization_id`, `current_user_role`)
  - `20260507000001_patients.sql` + `20260507000002_search_patients_rpc.sql` (référentiel + recherche fuzzy `pg_trgm` + `unaccent`)
  - `20260508000001..05_legal_compliance.sql` (RGPD : DPA, DPIA, registre traitements, demandes patient, breach 72h, DPO, anonymize)
  - `20260509000001_rides.sql` (courses)
  - `20260512000001_drivers.sql` / `20260512000002_vehicles.sql` / `20260512000003_rides_execution.sql` (Passe 1 E2E)
  - `20260513000001_search_patients_ilike_fix.sql` / `20260513000002_anonymize_seed_profiles.sql` / `20260514000001_rides_cancel_motif.sql`
- Tests RLS pgTAP : `supabase/tests/` (16 fichiers)
- Génération de types : `pnpm db:types` → `packages/database/src/types.gen.ts` ; workflow `sync-types.yml` régénère automatiquement chaque jour à 3h UTC depuis prod

**File Storage:**
- Supabase Storage : activé dans `supabase/config.toml` (`file_size_limit = "50MiB"`) ; aucun bucket utilisé dans le code applicatif actuellement
- Stockage scans bons de transport prévu pour V2 commerciale (nécessite hébergement HDS, cf. CLAUDE.md § 1 pilier 3)

**Caching:**
- Aucun cache externe (pas de Redis, Memcached). React Query côté client gère le cache d'UI.
- Turborepo cache local (build/test) — cache distant Vercel non configuré explicitement.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (GoTrue) — PKCE flow imposé par CLAUDE.md
- 3 rôles métier (`public.user_role` enum, migration `20260506000001_foundations.sql`) : `dirigeant`, `regulateur`, `chauffeur`
- Profils dans `public.profiles` (extension `auth.users` + `organization_id` + `role`)
- Trigger anti-élévation : un utilisateur non-dirigeant ne peut modifier `organization_id`/`role`/`actif` sur son propre profil (ADR-002)
- Config Supabase (`supabase/config.toml`) :
  - `jwt_expiry = 3600`
  - `minimum_password_length = 12`
  - `password_requirements = "lower_upper_letters_digits_symbols"`
  - `enable_refresh_token_rotation = true`
  - `enable_anonymous_sign_ins = false`
- Wrappers clients dans `packages/database/src/` : `client-browser.ts` (createBrowserClient), `client-server.ts` (createServerClient cookies), `middleware-client.ts`
- Wrappers app dans `apps/web/src/lib/supabase/` : `client.ts`, `server.ts`, `middleware.ts`, `admin.ts`
- Helper auth context : `apps/web/src/lib/auth/get-auth-context.ts`
- Middleware Next.js : `apps/web/src/middleware.ts` (refresh session + redirection /setup si config Supabase manquante)
- Comptes démo persistants (preview/staging via `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true`) : `dirigeant@demo.tap` / `regulateur@demo.tap` / `chauffeur@demo.tap` mot de passe `demo1234!`, seedés via `supabase/seed.sql`

**JWT applicatif :**
- Portail patient RGPD (D-10) — JWT HS256 généré/vérifié via `jose` ^6.2.3 dans `packages/shared/src/utils/legal-token.ts`, secret `APP_LEGAL_TOKEN_SECRET` (32 bytes minimum, serveur-only)

**Chiffrement applicatif (données santé) :**
- NIR (numéro sécurité sociale) — chiffré AES-256-GCM via Web Crypto API native Deno dans l'Edge Function `nir` (`supabase/functions/nir/_shared/crypto.ts`)
  - Format payload : `VERSION_BYTE (0x01) || iv(12) || ciphertext || tag(16)`, encodé base64
  - Clé `APP_NIR_ENCRYPTION_KEY` : 32 bytes base64, jamais dans le bundle Next.js
  - Hash de recherche déterministe : HMAC-SHA256 avec clé séparée `APP_NIR_SEARCH_KEY` (jamais la même que la clé de chiffrement)
  - Affichage masqué : `nir_last4` (4 derniers chars en clair "XX YY") retournés par l'action `encrypt`
  - Audit log forcé côté Edge Function sur action `decrypt` (impossible à bypass par le caller) — insertion `audit_logs` action `patient.nir.decrypt`
- Wrapper TS côté Server Action : `apps/web/src/lib/nir-client.ts` (fonctions `encryptAndHashNir`, `decryptNir`, `hashNir`)
- Anonymisation RGPD : `packages/shared/src/utils/patient-anonymize.ts` avec salt `APP_ANONYMIZATION_SALT`

## Monitoring & Observability

**Error Tracking:**
- Sentry — variables déclarées dans `.env.example` (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`) ; **non encore intégré dans le code** (pas d'`import @sentry/*` détecté), reste sur la roadmap CLAUDE.md § 3
- Cookie `sentry-trace` mentionné préventivement dans `apps/web/src/content/legal/cookies.md`

**Logs:**
- Supabase Postgres logs (accessibles via Studio + MCP `get_logs`)
- Vercel build/runtime logs (console.error autorisés ; CLAUDE.md interdit `console.log` en commit)
- Audit applicatif : table `public.audit_logs` (migration 001) — insertée systématiquement lors d'actions sensibles : CRUD patient/ride, décryptage NIR, anonymisation RGPD, modifications profil, accès portail patient
- Triggers d'audit pgSQL : `rides_audit.sql` + `rides_execution_transitions.sql` + 3 triggers d'audit dans la migration `patients`

## CI/CD & Deployment

**Hosting:**
- Vercel — `apps/web` (Next.js), région `cdg1`, build command `pnpm turbo run build --filter=@tap/web`

**CI Pipeline (GitHub Actions) :**
- `.github/workflows/ci.yml` — sur push/PR (`main`, `staging`)
  - Jobs : `install` → `lint` (+ `format:check`) / `typecheck` / `test` (Vitest) / `rls-tests` (pgTAP via supabase CLI)
- `.github/workflows/cd.yml` — sur push `main`, jobs séquentiels :
  1. `deploy-migrations` — `supabase link` + `supabase db push --linked` + apply `seed.sql` + `seed.demo.sql` via psql Supavisor pooler (port 5432, IPv4)
  2. `deploy-edge-functions` — `supabase functions deploy nir`
  3. `vercel deploy --prod`
- `.github/workflows/setup-vercel.yml` — workflow_dispatch idempotent qui configure end-to-end Vercel + Supabase (récupère credentials Supabase via API, génère/conserve les 4 app secrets, push 8 env vars Vercel, push 2 NIR secrets dans Supabase Edge Functions, trigger redeploy)
- `.github/workflows/preview-smoke.yml` — déclenché sur event `deployment_status` (success + environment Preview), lance `apps/web/tests/smoke/preview.spec.ts` Playwright sur l'URL de preview (block merge si rouge)
- `.github/workflows/sync-types.yml` — cron quotidien 3h UTC, régénère `packages/database/src/types.gen.ts` depuis prod et ouvre une PR si diff

**Secrets GitHub Actions requis (cf. `setup-vercel.yml` header) :**
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`

## Environment Configuration

**Required env vars (production Vercel) :**
- `NEXT_PUBLIC_SUPABASE_URL` — public, bundle client OK
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, bundle client OK
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, jamais retourné au client
- `APP_NIR_ENCRYPTION_KEY` — server-only + Supabase Edge Function secret
- `APP_NIR_SEARCH_KEY` — server-only + Supabase Edge Function secret
- `APP_LEGAL_TOKEN_SECRET` — server-only (JWT portail patient HS256)
- `APP_ANONYMIZATION_SALT` — server-only (salt RGPD)
- `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` — flag preview/staging (vaut `true` en preview, FAUX en prod commerciale)

**Variables déclarées mais non consommées (réservées passes futures) :**
- `APP_ENCRYPTION_KEY` (notes médicales V2)
- `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (Passe 3)
- `OSRM_BASE_URL` (Passe 4+)
- `OPTIMIZER_BASE_URL` (Phase 10+)
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (à intégrer)

**Secrets location:**
- Production : Vercel project env vars (poussées par `setup-vercel.yml`) + Supabase Edge Function secrets (NIR uniquement)
- Développement : `.env.local` à la racine et/ou `apps/web/.env.local` (cf. `.env.example` et `apps/web/.env.local.example`)
- Aucun secret dans le repo ; `pg_temp.seed_demo_user` utilise `crypt()` pour hacher les mots de passe démo bcrypt
- Le fichier `.env` racine est listé dans `turbo.json` `globalDependencies` pour invalider le cache de build si modifié

## Webhooks & Callbacks

**Incoming (recevoir) :**
- `event: deployment_status` GitHub Actions — déclenche `preview-smoke.yml` (Vercel → GitHub via deployment events natifs)
- Aucun webhook entrant applicatif (pas de route `/api/webhooks/*`)

**Outgoing (envoyer) :**
- Aucun webhook sortant pour l'instant
- À venir : delivery status Twilio (SMS rappel patient), à intégrer dans Passe 3

**Routes API HTTP actuelles (`apps/web/src/app/api/`) :**
- `POST /api/legal/cookie-consent` — log consentement cookies dans `audit_logs` (route serveur, `route.ts`)
- `GET /api/admin/legal/registre/pdf` — génération PDF registre RGPD via `@react-pdf/renderer` runtime nodejs, auth dirigeant requise (`route.tsx`)
- Le reste des mutations passe par des **Server Actions** Next.js, pas par des routes API REST

---

*Integration audit: 2026-05-12*
