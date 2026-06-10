# External Integrations

**Analysis Date:** 2026-06-10
**Last updated:** 2026-06-10

## APIs & External Services

**Plateforme Supabase (BaaS principal) :**
- Supabase Cloud — Postgres + Auth + Realtime + Storage + Edge Functions
  - SDK : `@supabase/supabase-js` ^2.45.4 + `@supabase/ssr` (via `@tap/database`)
  - URL : `NEXT_PUBLIC_SUPABASE_URL`
  - Auth client (anon) : `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Auth admin (bypass RLS, serveur uniquement) : `SUPABASE_SERVICE_ROLE_KEY` (`apps/web/src/lib/supabase/admin.ts`)
  - Project ref / access token (CI/CD only) : `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`
- Supabase Realtime — abonnements `postgres_changes` côté cockpit régulateur et messagerie :
  - `apps/web/src/app/(app)/cockpit/_lib/use-cockpit-rides.ts`, `use-cockpit-alerts.ts`, `use-driver-positions.ts`
  - `apps/web/src/lib/messaging/use-ride-messages.ts`
- Supabase Management API — appelée par `.github/workflows/setup-vercel.yml` (région du projet, anon/service_role keys, push secrets `APP_NIR_*` dans le secret store des Edge Functions)
- Supabase Edge Functions (Deno runtime) — déployées via `supabase functions deploy nir` (`.github/workflows/cd.yml`)
  - Function `nir` — dispatcher HTTP `encrypt | decrypt | hash` (`supabase/functions/nir/index.ts`)
  - Function `_shared` — helpers CORS communs (`supabase/functions/_shared/cors.ts`)
- Supabase `pg_cron` + `pg_net` — planification SMS côté base (migration `20260519000007_pg_net_pg_cron_setup.sql`, désactivation `20260524000001_unschedule_sms_cron.sql`)

**Vercel (hébergement front) :**
- Vercel API — `setup-vercel.yml` push les env vars puis trigger redeploy
- Auth : `VERCEL_TOKEN` (account token) ; identifiants projet : `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- Région exécution : `cdg1` (Paris) déclarée dans `vercel.json`

**Géocodage adresses (intégré) :**
- BAN / Géoplateforme — `data.geopf.fr/geocodage` (migration depuis `api-adresse.data.gouv.fr`), shape GeoJSON FeatureCollection identique BAN
  - Helper : `apps/web/src/lib/geocoding/ban.ts` + safety-net `geocode-safety-net.ts`
  - Biais Réunion : `BAN_REUNION_LAT/LON`, `MIN_SCORE`, `REUNION_POSTCODE_PREFIX`
  - Consommé par la saisie course (géocodage adresses départ/arrivée — migration `20260516000005_rides_geocoding.sql`)

**Cartographie (intégré) :**
- MapLibre GL ^4.7 + PMTiles ^3.2 — carte cockpit/positions chauffeur (`apps/web/src/components/map/`)
  - Tuiles servies localement (`public/tiles/reunion.pmtiles`), fallback raster OSM (ADR-012)

**SMS patient (intégré, fournisseur Twilio) :**
- Twilio — adaptateur `packages/sms/src/twilio-adapter.ts` ; consentement `consent-checker.ts` ; rendu template `template-renderer.ts`
- Variables : `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- Webhook delivery status entrant : `POST /api/sms/webhook/twilio` (`apps/web/src/app/api/sms/webhook/twilio/route.ts`)
- Rappels planifiés via Route Handlers cron (`/api/cron/sms-reminders-j1`, `/api/cron/sms-reminders-j2h`) protégés par `CRON_APP_TOKEN`
- ADR-004 : fournisseur initialement différé, désormais câblé (Passe 3)

**Monitoring (intégré) :**
- Sentry — `@sentry/nextjs` ^8.42 ; configs `apps/web/sentry.server.config.ts`, `sentry.edge.config.ts`, instrumentation client, `src/app/global-error.tsx`
- Scrubbing PII avant envoi : `apps/web/src/lib/sentry/scrub.ts` (purge NIR / données santé)
- Variables : `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`

**Optimisation tournées (interne, pas de service externe) :**
- Heuristique TypeScript native dans `apps/web/src/lib/optimizer/` (`solve-local.ts`, `haversine.ts`) — ADR-010
- Exposée via `POST /api/optimizer` (`apps/web/src/app/api/optimizer/route.ts`)
- Microservice Python OR-Tools (`services/optimizer`) **abandonné** ; `services/` n'existe plus ; `packages/optimizer-client` vestige vidé (ADR-008/009/010)
- `OSRM_BASE_URL` / OSRM auto-hébergé : non intégré (différé Passe 4+)

**À venir (déclarées, non intégrées) :**
- OVH SMS Pro (alternative Twilio) — non câblé
- Web Push API (VAPID) — non intégré
- Télétransmission B2/CNDA (ADR-005), portail B2B (ADR-006) — différés

## Data Storage

**Databases:**
- PostgreSQL 15 hébergé sur Supabase Cloud (single tenant DB, multi-tenant logique par `organization_id` + RLS forcée — ADR-002)
- Connexion : SDK Supabase exclusivement côté app ; `pg` ^8.13 (driver direct) uniquement pour la page d'amorçage `/setup` (`apps/web/src/app/setup/actions.ts`, lit `POSTGRES_URL_NON_POOLING`/`POSTGRES_URL`)
- 46 migrations Supabase (`supabase/migrations/`) couvrant : foundations + RLS, patients + recherche fuzzy (`pg_trgm`/`unaccent`), légal/RGPD (DPA/DPIA/registre/breach 72h/DPO/anonymize), rides + exécution, drivers/vehicles/invitations, POIs métier, géocodage rides, perf RLS + index FK, hotfix récursion RLS SECURITY DEFINER, idempotency keys, récurrences (`ride_recurrences` + exceptions + jours fériés 974), SMS (`sms_messages`/`sms_templates` + no-show + pg_net/pg_cron), ride_events, grilles tarifaires (`tariff_grids` + override source), positions chauffeur (`driver_positions`), conformité (`compliance_items` + blocking mode), messagerie interne (`internal_message`)
- Tests RLS pgTAP : `supabase/tests/` (35 fichiers)
- Génération de types : `pnpm db:types` → `packages/database/src/types.gen.ts` ; `sync-types.yml` régénère automatiquement chaque jour 3h UTC depuis prod

**File Storage:**
- Supabase Storage activé (`config.toml`, `file_size_limit = "50MiB"`) ; aucun bucket consommé par le code applicatif
- Scans bons de transport prévus V2 commerciale (HDS requis — CLAUDE.md § 1 pilier 3)

**Caching:**
- Aucun cache externe (pas de Redis/Memcached). React Query gère le cache UI client.
- Turborepo cache local (build/test) ; cache distant Vercel non configuré explicitement.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (GoTrue) — PKCE flow imposé
- 3 rôles métier (`public.user_role` enum) : `dirigeant`, `regulateur`, `chauffeur`
- Profils dans `public.profiles` (extension `auth.users` + `organization_id` + `role`)
- Trigger anti-élévation : un non-dirigeant ne peut modifier `organization_id`/`role`/`actif` sur son profil (ADR-002)
- Config (`supabase/config.toml`) : `jwt_expiry = 3600`, `minimum_password_length = 12`, `password_requirements = lower_upper_letters_digits_symbols`, `enable_refresh_token_rotation = true`, `enable_anonymous_sign_ins = false`
- Wrappers clients dans `packages/database/src/` : `client-browser.ts`, `client-server.ts`, `middleware-client.ts`
- Wrappers app dans `apps/web/src/lib/supabase/` : `client.ts`, `server.ts`, `middleware.ts`, `admin.ts`
- Helper auth context : `apps/web/src/lib/auth/get-auth-context.ts`
- Auth chauffeur dédiée (token invitation) : `apps/web/src/lib/api/driver-auth.ts` (migration `20260514000002_driver_invitations.sql`)
- Middleware Next.js : `apps/web/src/middleware.ts` (refresh session + redirection /setup si config manquante)
- Comptes démo persistants (preview/staging via `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true`), seedés via `supabase/seed.demo.sql`

**JWT applicatif :**
- Portail patient RGPD — JWT HS256 via `jose` ^6.2.3 dans `packages/shared/src/utils/legal-token.ts`, secret `APP_LEGAL_TOKEN_SECRET`

**Chiffrement applicatif (données santé) :**
- NIR — chiffré AES-256-GCM via Web Crypto native Deno dans l'Edge Function `nir` (`supabase/functions/nir/_shared/crypto.ts`)
  - Payload `VERSION_BYTE(0x01) || iv(12) || ciphertext || tag(16)` base64
  - Clé `APP_NIR_ENCRYPTION_KEY` (32 bytes base64), jamais dans le bundle Next.js
  - Hash recherche déterministe HMAC-SHA256 avec clé séparée `APP_NIR_SEARCH_KEY`
  - `nir_last4` masqué retourné par `encrypt` ; audit log forcé côté Edge Function sur `decrypt`
- Wrapper TS côté Server Action : `apps/web/src/lib/nir-client.ts` (`encryptAndHashNir`, `decryptNir`, `hashNir`)
- Anonymisation RGPD : `packages/shared/src/utils/patient-anonymize.ts` avec salt `APP_ANONYMIZATION_SALT`

## Monitoring & Observability

**Error Tracking:**
- Sentry intégré (cf. section APIs). Scrubbing PII obligatoire avant envoi (`src/lib/sentry/scrub.ts`).

**Logs:**
- Supabase Postgres logs (Studio + MCP `get_logs`)
- Vercel build/runtime logs (`console.error` autorisé ; `console.log` interdit en commit)
- Audit applicatif : table `public.audit_logs` insérée systématiquement (CRUD patient/ride/driver/vehicle, décryptage NIR, anonymisation RGPD, modifications profil, accès portail patient, envois SMS, tarifs)
- Triggers d'audit pgSQL : `rides_audit`, transitions d'exécution `ride_events`, triggers patients/SMS

## CI/CD & Deployment

**Hosting:**
- Vercel — `apps/web` (Next.js), région `cdg1`, build `pnpm turbo run build --filter=@tap/web`

**CI Pipeline (GitHub Actions) :**
- `.github/workflows/ci.yml` — push/PR (`main`, `staging`) : `install` → `lint`/`format:check`/`typecheck`/`test` (Vitest)/`rls-tests` (pgTAP)
- `.github/workflows/cd.yml` — push `main` : `deploy-migrations` (`supabase db push` + seed via pooler) → `deploy-edge-functions` (`functions deploy nir`) → `vercel deploy --prod`
- `.github/workflows/setup-vercel.yml` — workflow_dispatch idempotent (wiring env Vercel + secrets NIR Supabase)
- `.github/workflows/preview-smoke.yml` — `deployment_status` Preview → `apps/web/tests/smoke/preview.spec.ts` Playwright (block merge si rouge)
- `.github/workflows/sync-types.yml` — cron 3h UTC, régénère `packages/database/src/types.gen.ts` et ouvre une PR si diff

**Secrets GitHub Actions requis :**
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`
- `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`

## Environment Configuration

**Required env vars (production Vercel) :**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, bundle client OK
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `APP_NIR_ENCRYPTION_KEY`, `APP_NIR_SEARCH_KEY` — server-only + Edge Function secrets
- `APP_LEGAL_TOKEN_SECRET`, `APP_ANONYMIZATION_SALT` — server-only
- `CRON_APP_TOKEN` — protège les Route Handlers cron SMS
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `SMS_PROVIDER` — SMS patient
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` — monitoring
- `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` — flag preview/staging (FAUX en prod commerciale)
- `GEOLOC_ENABLED` — toggle géolocalisation chauffeur

**Variables déclarées mais non consommées (réservées) :**
- `APP_ENCRYPTION_KEY` (notes médicales V2), `OSRM_BASE_URL` (Passe 4+), `OPTIMIZER_BASE_URL` (vestige ADR-010)

**Secrets location:**
- Production : Vercel project env vars (poussées par `setup-vercel.yml`) + Supabase Edge Function secrets (NIR uniquement)
- Développement : `.env.local` racine et/ou `apps/web/.env.local`
- Aucun secret dans le repo ; mots de passe démo hachés par `crypt()` dans le seed

## Webhooks & Callbacks

**Incoming (recevoir) :**
- `POST /api/sms/webhook/twilio` — delivery status SMS Twilio → mise à jour `sms_messages`
- `event: deployment_status` GitHub Actions — déclenche `preview-smoke.yml`

**Outgoing (envoyer) :**
- Envois SMS Twilio (rappels patient via cron + envois ponctuels)
- Appels géocodage BAN sortants (`data.geopf.fr`)

**Routes API HTTP actuelles (`apps/web/src/app/api/`) :**
- `POST /api/legal/cookie-consent` — log consentement cookies
- `GET /api/admin/legal/registre/pdf`, `/api/admin/chauffeurs/recap/pdf`, `/api/admin/facturation/pdf` — exports PDF (`@react-pdf/renderer`, runtime nodejs, auth dirigeant)
- `POST /api/driver/rides/[rideId]/{start,end,no-show}` — actions chauffeur (idempotency keys)
- `POST /api/cron/sms-reminders-{j1,j2h}` — rappels SMS planifiés (`CRON_APP_TOKEN`)
- `POST /api/sms/webhook/twilio` — webhook delivery
- `POST /api/optimizer` — heuristique tournées TS
- Le reste des mutations passe par des **Server Actions**, pas par des routes REST

---

*Integration audit: 2026-06-10*
