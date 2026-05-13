# Phase 04 — E2E Passe 2 — PWA + tarif CGSS auto + caisse + refonte login — Context

**Gathered:** 2026-05-13 (assumptions mode, enriched par discuss méta du dirigeant)
**Status:** Ready for planning
**Précédent CONTEXT.md** : esquisse 2026-05-11 (post-ADR-003), remplacé par cette version enrichie.

---

<domain>
## Phase Boundary

**Goal fonctionnel** : Le chauffeur installe la PWA sur son téléphone comme une vraie app native, travaille hors-ligne pendant 1 heure et synchronise au retour réseau. Le tarif CGSS court trajet est calculé automatiquement à la clôture (forfait base + distance estimée) avec override manuel possible. La régulatrice voit un récap caisse de la journée par chauffeur.

**Goal UX** : Installation PWA propre (manifest, icônes 192/512, splash identité, theme color cohérent). Transitions natives iOS-style entre `/conduite` ↔ `/conduite/[rideId]`. Indicateurs offline/synching/synced discrets mais visibles. Récap caisse table dense type Stripe Balance avec totaux tabulaires en pied. Refonte `/login` `/welcome` `/setup` : layout split avec zone identité + form, comptes démo cliquables si DEMO_MODE, mode nuit cohérent.

**Critère de fin (ADR-003)** : Un design partner complète le parcours Passe 2 sans intervention dev.

**Périmètre — dans :**
- Serwist : manifest + service worker scope `/conduite*` (cache courses du jour à l'ouverture)
- Dexie 4.x : source de vérité PWA chauffeur, queue mutations, sync metadata
- Sync engine : flush queue au retour réseau, retry exponentiel + dead letter queue
- Indicateurs visuels offline/synching/synced (badge header via `useLiveQuery` Dexie)
- `packages/pricing` : CGSS court trajet auto (forfait + distance OSRM externe + fallback Haversine), 100% Vitest
- Migration BDD : `rides.pickup_lat/lng/citycode` + `dropoff_lat/lng/citycode` nullable
- Override tarif manuel tracé `audit_logs`
- `/courses/caisse?date=YYYY-MM-DD` : table par chauffeur expandable + totaux + export CSV
- Refonte légère `/login` `/welcome` `/setup` (layout split, comptes démo cliquables, mode nuit)
- Workflow invitation chauffeur : magic link Supabase Auth + `/accept-invite`
- Adoption React Hook Form pour tous nouveaux formulaires Phase 04
- Découpe `ride-express-modal` (384L → <200L) + `ride-drawer` (337L → <200L)
- Filtrage type_permis ↔ vehicle.type modal assignation (dette CONCERNS.md)
- Audit logs nom acteur (timeline avec prénom/nom au lieu de "regulateur" générique)
- Régénération types Supabase (`supabase gen types typescript`) + suppression des 5 TODO(types)

**Périmètre — hors (reporté Passe 4+ ou phase UI/UX dédiée)** :
- Hors-ligne > 1h
- CGSS long trajet, suppléments TPMR, attente
- Push notifications, géolocalisation temps réel
- Récurrences (Passe 3)
- **Polish UI/UX modal saisie course** (verrou CONCERNS.md ligne 197 — INTERDIT Phase 04)
- Refonte visuelle complète `/login` (phase UI/UX dédiée post-Passe 2)
- Resend/Brevo email transactionnel (Phase 06+)
- Self-host OSRM (Phase 06+)
- Script batch backfill géocoding courses pré-Phase-04 (Phase 06 si volume)
- TTS lecture vocale au démarrage course (ROADMAP esquisse, retiré du scope enrichi)

**Success criteria** :
1. PWA installable propre iPhone + Android (icônes nettes, splash identité, theme_color cohérent)
2. Démarrer + clôturer course en mode avion, mutation sync au retour réseau, `audit_logs` cohérent
3. Tarif CGSS court trajet ±0,01 € vs 5+ cas de référence validés par design partner
4. Override tarif tracé `audit_logs` avec ancien montant + delta
5. `/courses/caisse` affiche récap journée + export CSV ouvre sans encoding cassé dans Excel FR
6. `/login` refonte capture publiable, mode nuit à parité, comptes démo cliquables fonctionnels
</domain>

<decisions>
## Implementation Decisions

### Découpage Phase (LOCKED)

- **DEC-017** : Phase 04 livrée **monolithique E2E** (ADR-003), pas de split 04-A / 04-BCD. Vélocité estimée 17-25h discuss→ship pour 4 livrables hétérogènes. Plan en 5-7 plans répartis sur 6 vagues.

### Stack offline-first (LOCKED — DEC-019)

- **D-01** : **Serwist** comme service worker (successeur officiel `next-pwa` et `@ducanh2912/next-pwa`, recommandé doc Next.js 2026, basé Workbox). Configuration via `withSerwistInit` dans `next.config.ts`.
  - `reloadOnOnline: false` obligatoire (sinon retour réseau force `location.reload()` et chauffeur perd sa saisie en cours).
  - `disable: process.env.NODE_ENV === 'development'` (DX non saboté).
  - Scope SW : `/conduite*` uniquement (régulateur au bureau, connexion stable, pas la priorité V1).
- **D-02** : **Dexie 4.x** comme source de vérité PWA chauffeur. React Query disparaît de `/conduite`, queries Supabase miroirées dans Dexie. Régulateur `/courses` garde React Query classique.
  - 3 raisons concrètes vs raw IndexedDB / `idb-keyval` :
    a) `useLiveQuery` réactif (badge "N mutations en attente" auto-update sans recâbler invalidation tanstack/query)
    b) Migrations versionnées déclaratives (`db.version(2).stores`)
    c) Mature (3M DL/sem, TypeScript-first)
  - Coût ~30 KB gzip vs ~5 KB idb — négligeable pour PWA cachée localement.
- **D-03** : Manifest static `apps/web/public/manifest.json` + icônes 192/512, theme_color cohérent, splash via `<link rel="apple-touch-startup-image">` par DPR (Android automatique, iOS manuel obligatoire). Registration SW via client component dans `apps/web/src/app/(driver)/layout.tsx`.

### Offline Queue & Sync

- **D-04** : Table Dexie `mutations_queue` (1 mutation = 1 ligne `{action, args, timestamp, retries, status}`).
- **D-05** : Retry exponentiel base 2s + jitter ±500ms, max 30s, **3 essais max**, puis dead letter queue avec toast Sonner "Échec sync, voir régulateur".
- **D-06** : Listener `window.addEventListener('online', flushQueue)` pour replay (Background Sync API non supporté iOS 17+/18 — confirmé recherche 2026, contournement obligatoire).
- **D-07** : Conflits sync : **LWW** (Last Write Wins) partout sauf paiement où **server-wins obligatoire** (on ne peut pas écraser un encaissement BDD par un état offline obsolète). `audit_logs` INSERT-only côté serveur, pas de conflit possible.
- **D-08** : Indicateurs visuels offline/synching/synced via `useLiveQuery` Dexie sur `pendingCount` (badge header `(driver)/layout.tsx`).
- **D-09** : **Mode invocation Server Action vs Route Handler depuis le sync engine** = à trancher empiriquement Wave 1 par spike. Tenter Server Actions via `fetch(actionURL, { method: 'POST', body: serializedFormData, headers: {'Next-Action': ...} })` d'abord (préserve convention CONVENTIONS.md § Server Actions). Si flaky ou non documenté Next 14.2/15 → fallback Route Handlers `/api/driver/rides/[id]/start|end` qui délèguent à la même logique métier extraite. **Le planner inclura ce spike comme tâche Wave 1.**

### Pricing CGSS (LOCKED — DEC-013 100% coverage)

- **D-10** : Nouveau workspace `packages/pricing` clone du layout `packages/shared` (private, type module, vitest, deps `zod` + `@tap/database`). Ajout à `transpilePackages` dans `next.config.mjs`.
- **D-11** : Fonction pure `computeCgssShortTrip({ pickup, dropoff, scheduledAt, options })` → `{ amount_eur, breakdown: { forfait_base, distance_km, prix_par_km, total }, source: 'cgss_auto' }`. 100% branch coverage Vitest (DEC-013).
- **D-12** : **Distance OSRM externe primary, Haversine fallback** :
  - OSRM : `router.project-osrm.org` gratuit V1 (5000 req/jour public, largement suffisant design partner unique). Self-host OSRM = Phase 06.
  - Haversine pure JS appliqué si OSRM indispo / chauffeur offline. Stocker `distance_estimation_method: 'osrm' | 'haversine'` pour audit.
- **D-13** : Migration ajoute `rides.pickup_lat numeric(10,7), pickup_lng numeric(10,7), pickup_citycode text` + `dropoff_*` idem, tous **nullable** (rétrocompat). Threadé depuis `AddressPickerField` BAN (D-ADDR-06 lifté).
- **D-14** : Grille démarrage = **forfait prise en charge 2,60 € + 1,10 €/km court trajet** (taxi conventionné national). Design partner valide ensuite avec 5+ cas de référence (±0,01 € accuracy SC #3). Si CGSS Réunion dérive du national → adaptation paramétrée dans la grille hardcodée du package.
- **D-15** : Backfill courses pré-Phase-04 : laisser `lat/lng` à `null`. Tarif manuel accepté pour ces courses (override path déjà existe). Script batch reverse-geocoding = Phase 06 si volume justifie.
- **D-16** : Override manuel toujours possible (`tarif_source: 'manuel'`), tracé `audit_logs` avec ancien montant + delta + raison libre.

### Caisse Page

- **D-17** : `/courses/caisse?date=YYYY-MM-DD` = Server Component + nouveau `_lib/queries-caisse.ts` (miroir du pattern `_lib/queries-enriched.ts`).
- **D-18** : Table groupée par `driver_id` avec **groupes expandables** (lignes courses visibles à l'expand) + sous-totaux + total dans `<tfoot>`. Style dense type Stripe Balance.
- **D-19** : Export CSV via Server Action retournant `Response` `Content-Type: text/csv; charset=utf-8` avec **UTF-8 BOM (code point `U+FEFF`, à préfixer à la string CSV)** + **séparateur `;`** + **format date FR (jj/mm/aaaa)** pour ouverture Excel FR sans encoding cassé. Pas de lib externe (papaparse / csv-stringify).
- **D-20** : Permissions **régulateur + dirigeant uniquement**, chauffeur exclu via RLS sur la query Server Component + Server Action export CSV.

### Refonte Login (légère)

- **D-21** : Composant `<AuthShell>` dans `apps/web/src/app/(auth)/_components/` — layout split (identité gauche : logo TAP existant + baseline, form droite). Réutilisé par `/login` `/welcome` `/setup`.
- **D-22** : **Refonte légère** — logo TAP conservé, refonte visuelle complète (charte, baseline, splash) = phase UI/UX dédiée post-Passe 2.
- **D-23** : `DemoCredentials` (`apps/web/src/components/demo-credentials.tsx`) converti Server Component → Client Component avec **cards cliquables** qui prefill email + password (3 comptes : dirigeant, regulateur, chauffeur) si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`. Si `=== '0'` ou absent, zone démo absente, login standard.
- **D-24** : Mode nuit : **toggle persistant via cookie httpOnly** (`next/headers` cookies, server-side read pour SSR sans flash). Pref Supabase `users.theme_preference` reportée Phase 06+. Infra Tailwind dark mode déjà en place (`tailwind.config.ts` `darkMode: ['class', '[data-theme="dark"]']` + tokens CSS vars `globals.css`).

### Workflow Invitation Chauffeur

- **D-25** : Magic link **Supabase Auth built-in** suffit V1 (template SES par défaut). Resend / Brevo email transactionnel = Phase 06+ si feedback design partner.
- **D-26** : Page `/accept-invite?token=...` → user crée mot de passe → Server Action rattachement `drivers.profile_id = auth.uid()`. RLS update sur `drivers` autorise cette mise à jour si la ligne `profile_id IS NULL` et l'invitation token est valide.

### Architecture & Refactos

- **D-27** : **Adoption React Hook Form Phase 04+** (DEC-018) pour TOUS nouveaux formulaires : clôture course, override tarif, caisse filters, login refonte, accept-invite. **Pas de migration rétroactive** Phase 1/2 sauf si on touche le formulaire pour autre raison. RHF + `zodResolver` standardise validation client/serveur sur les schémas Zod existants `packages/shared`. Server Actions conservées côté submit.
- **D-28** : Découpe `ride-express-modal.client.tsx` (384L → <200L orchestrateur fin) — extraction `HeaderBar`, `ActionsBar`, `NotesField`. `PatientPickerField`, `DateTimeFields`, `AddressPickerField` (×2), `ModeUrgencyFields` sont déjà extraits.
- **D-29** : Découpe `ride-drawer.client.tsx` (337L → <200L) — extraction `DrawerHeader`, `TrajetSection`, `ModeSection`, `AssignationSection`, `ExecutionSection`, `PaiementSection`, `HistoriqueSection`.
- **D-30** : Filtrage type_permis ↔ `vehicle.type` dans modal assignation (dette CONCERNS.md severity major).
- **D-31** : Audit logs nom acteur — timeline `ride-drawer` affiche prénom/nom au lieu du rôle générique `regulateur`. Join `audit_logs.actor_id → profiles.first_name + last_name`.
- **D-32** : Régénération types Supabase (`pnpm db:types`) → suppression des 5 occurrences `TODO(types)` du code Phase 03.

### Plan Phase prévu (5-7 plans, 6 vagues)

- **W0** : Prérequis — 10 captures showcase Phase 03 + docs CONVENTIONS (2 apprentissages 03.2) + STATE Phase 03.2 shipped + ROADMAP nettoyage 03.1.1 + DEC-017/018/019 dans PROJECT.md + ADR-003 dans PROJECT.md + types regen
- **W1** : Serwist scaffold + Dexie schema + manifest + icônes + **spike Server Action vs Route Handler** (D-09)
- **W2** : Sync engine (queue, retry, dead letter, indicateurs UI) + RHF migration formulaires Phase 04
- **W3** : `packages/pricing` (100% Vitest) + migration BDD géocoding rides
- **W4** : `/courses/caisse` (table expandable + CSV BOM) + refonte `/login` (AuthShell + DemoCredentials clickable + mode nuit cookie) + workflow invitation chauffeur
- **W5** : Découpe `ride-express-modal` + `ride-drawer` + filtrage type_permis + audit_logs nom acteur
- **W6** : E2E Playwright PWA offline (course mode avion → sync au retour) + UAT preview Vercel

### Verrous explicites

- **Polish UI/UX modal saisie course INTERDIT Phase 04** (CONCERNS.md ligne 197). Phase UI/UX dédiée post-Passe 2 traitera proportions Mode/Urgence, espacement vertical, asymétrie icônes date/heure, etc.
- **5 captures Visible Progress Phase 04 obligatoires** (CLAUDE.md § 13.5) :
  - PWA installée écran d'accueil iPhone (capture mobile réelle)
  - Course clôturée en mode avion + indicateur sync
  - Tarif CGSS auto à la clôture avec breakdown km/forfait
  - `/courses/caisse` avec totaux journée
  - `/login` refonte split jour + nuit (2 captures = compté pour 1)

### Folded Todos

Aucun todo `.planning/todos/` matché pour Phase 04 (`gsd-sdk query todo.match-phase 04` → 0).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 04 section détaillée (lignes ~Phase 04 — passe 2)
- `.planning/REQUIREMENTS.md` — PRIC-01..04, CHAUF-01..04, CAIS-01..03, NFR-001..006
- `.planning/PROJECT.md` — 3 piliers, ADR-003 pivot E2E (à ajouter au bloc decisions Wave 0), DEC-017/018/019 (à inscrire Wave 0)
- `docs/cahier_des_charges_saas_tap_v2.docx` — § 7 tarification CGSS (grille démarrage et 5+ cas de référence à valider)
- `docs/adr/ADR-003.md` — pivot E2E par passes successives (consulté pour DEC-017)
- `.planning/codebase/CONCERNS.md` — **ligne 197 verrou Polish UI/UX modal saisie course** (INTERDIT Phase 04) + dette reportée Phase 04 (PWA, invitation chauffeur, filtrage type_permis, audit logs nom, types regen, refonte login, découpes 384L/337L)
- `.planning/codebase/CONVENTIONS.md` — Tailwind échelle `h-*` rem default vs spacing custom px, Radix Dialog inert siblings (pas de portalId externe), TZ `Indian/Reunion`, pattern Server Actions, pattern Dates, archivage logique no-DELETE
- `.planning/codebase/STACK.md` — Next.js 14 App Router, Supabase, Tailwind+shadcn, Sonner, tanstack/react-query
- `.planning/codebase/STRUCTURE.md` — layout monorepo apps/web + packages/*
- `.planning/codebase/ARCHITECTURE.md` — Server Components / Server Actions canoniques
- `CLAUDE.md` — § 5 PWA chauffeur (≥56px boutons, offline mode, mains occupées, mode contraste élevé), § 13.5 Visible Progress Mandate (preview URL + captures + seed démo + comptes démo + walkthrough)
- `apps/web/tailwind.config.ts` — `darkMode: ['class', '[data-theme="dark"]']` + `theme.extend.spacing` custom px
- `apps/web/src/app/globals.css` — tokens CSS vars dark mode `[data-theme='dark']`
- `apps/web/src/app/(driver)/layout.tsx` — point d'injection SW registration + manifest link
- `apps/web/src/app/(driver)/conduite/actions.ts` — `startRideAction`, `endRideAction` cibles offline queue
- `apps/web/src/app/(driver)/conduite/_components/end-ride-modal.client.tsx` — flow clôture actuel (tarif manuel)
- `apps/web/src/app/(app)/courses/actions/payment.ts` — `tarif_source` enum `('manuel', 'cgss_auto')` déjà prêt
- `apps/web/src/app/(app)/courses/_components/address-picker-field.client.tsx` — lat/lng BAN disponibles (D-ADDR-06 lifté Phase 04)
- `supabase/migrations/20260512000003_rides_execution.sql` — `tarif_source` check constraint
- `supabase/migrations/20260509000001_rides.sql` — pickup/dropoff_address text-only (migration géocoding à ajouter)
- `apps/web/src/app/(auth)/login/page.tsx` + `apps/web/src/app/welcome/page.tsx` + `apps/web/src/app/setup/page.tsx` — 3 auth shells à unifier via `<AuthShell>`
- `apps/web/src/components/demo-credentials.tsx` — Server Component à convertir Client cliquable
- `packages/shared/package.json` — template workspace pour nouveau `@tap/pricing`
- `pnpm-workspace.yaml` — glob `packages/*` couvre `packages/pricing` automatiquement
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Schema RLS multi-tenant** : `organization_id` + RLS forcée sur toutes les tables métier (FOND-02). La migration géocoding rides hérite automatiquement.
- **`tarif_source` enum** : `('manuel', 'cgss_auto')` déjà dans `supabase/migrations/20260512000003_rides_execution.sql` — anticipation Phase 04.
- **`AddressPickerField` BAN** : `apps/web/src/app/(app)/courses/_components/address-picker-field.client.tsx:35-37` reçoit lat/lng des features BAN mais ne les persiste pas (D-ADDR-06). Phase 04 lifte ce verrou.
- **Dark mode infra** : `tailwind.config.ts` + `globals.css` `[data-theme='dark']` tokens — pas de framework nouveau à intégrer, seulement le toggle + QA captures.
- **Shells auth pré-existants** : `(auth)/login`, `welcome`, `setup` réimplémentent quasi-identique `min-h-screen flex items-center justify-center` — extraction `<AuthShell>` = refactor, pas rewrite.
- **Pattern Server Component + helper lib** : `_lib/queries-enriched.ts` + `apps/web/src/app/(app)/courses/page.tsx` — pattern canonique pour `/courses/caisse`.
- **`DemoCredentials`** : Server Component à convertir Client cliquable pour prefill form, lift-state-up minimal.
- **`pnpm-workspace.yaml`** : `packages/*` glob couvre `packages/pricing` automatiquement.

### Established Patterns

- **Server Components par défaut** (CLAUDE.md § 7), `'use client'` seulement quand nécessaire.
- **Server Actions canoniques** pour mutations (CONVENTIONS.md § Server Actions). Phase 04 introduit potentiellement Route Handlers `/api/driver/rides/*/start|end` si le spike Wave 1 (D-09) le justifie.
- **Validation zod côté client + serveur** ; types via `z.infer`. RHF + zodResolver Phase 04+ standardise.
- **Audit logs INSERT-only** sur toute action sensible (CLAUDE.md § 6) — pas de risque de conflit sync.
- **Archivage logique no-DELETE** sur tables métier (CONVENTIONS.md D-01 du repo).
- **Pickers/popovers dans Radix Dialog → rendu inline, pas de portalId externe** (Phase 03.2.8, CONVENTIONS.md).
- **Classes hauteur Tailwind `h-*` = échelle default Tailwind en rem** (not spacing custom px). `h-10 = 40px` pour Input/Button/Select shadcn.

### Integration Points

- **`apps/web/src/app/(driver)/layout.tsx`** : point d'injection `<link rel="manifest">`, `<link rel="apple-touch-startup-image">` par DPR, et `'use client'` hook de registration SW Serwist.
- **`apps/web/src/app/(driver)/conduite/actions.ts`** : `startRideAction`, `endRideAction` — cibles de la queue offline. Spike Wave 1 décide si invocation directe via fetch (Next-Action header) ou via Route Handler proxy.
- **`apps/web/src/app/(app)/courses/_lib/`** : nouveau `queries-caisse.ts` à créer, miroir de `queries-enriched.ts`.
- **`apps/web/next.config.mjs`** : ajout `withSerwistInit` config + `transpilePackages: [..., '@tap/pricing']`.
- **`supabase/migrations/`** : nouvelle migration `2026MMDD000001_rides_geocoding.sql` (lat/lng/citycode nullable) + nouvelle migration `2026MMDD000002_driver_invitations.sql` (table `driver_invitations` + RLS).
- **`apps/web/src/app/(auth)/`** : groupe de routes existant, point d'extraction `<AuthShell>` dans `(auth)/_components/`.

### Spike & Recherche Recommandée Wave 1

- **D-09 spike** : Server Action via `fetch(actionURL, { headers: {'Next-Action': ...}, body: ... })` fonctionne-t-il dans Next 14.2 App Router depuis un sync engine non-React ? Test empirique 1-2h.
- **iOS Safari PWA 2026** : `apple-touch-startup-image` par DPR, `display: standalone` quirks, Background Sync API toujours non supporté en 17+/18 (recherche état de l'art déjà faite par dirigeant via Next docs + LogRocket Jan 2026 + Medium Apr 2026 + PkgPulse Mar 2026 — DEC-019).
- **Grille CGSS 974 numérique** : 5+ cas de référence à fournir par design partner pour atteindre SC #3 ±0,01 €. En attendant : grille nationale taxi conventionné (2,60 € + 1,10 €/km court trajet).
</code_context>

<specifics>
## Specific User Choices

- **Découpage** : monolithique E2E (DEC-017, ADR-003), pas de split 04-A / 04-BCD malgré le volume estimé 17-25h.
- **Stack offline** : Serwist + Dexie 4.x (DEC-019) — recherche d'état de l'art 2026 effectuée par le dirigeant (Next docs, LogRocket, Medium, PkgPulse).
- **Forms** : adoption RHF + zodResolver Phase 04+ (DEC-018), pas de migration rétroactive Phase 1/2.
- **Cache PWA scope** : `/conduite*` chauffeur uniquement (pas régulateur, connexion bureau stable).
- **Conflits sync** : LWW partout sauf paiement (server-wins) + audit_logs INSERT-only.
- **Source de vérité PWA** : Dexie côté chauffeur (React Query disparaît de `/conduite`). Régulateur garde React Query.
- **Distance** : OSRM externe primary (`router.project-osrm.org` gratuit V1, 5000 req/jour) + fallback Haversine si offline / down.
- **Backfill géocoding pré-04** : null laissé V1, script batch reverse-geocoding = Phase 06 si volume.
- **CSV caisse** : UTF-8 BOM (code point `U+FEFF`) + séparateur `;` + date `jj/mm/aaaa` pour ouverture Excel FR sans encoding cassé.
- **Caisse permissions** : régulateur + dirigeant uniquement, chauffeur exclu via RLS.
- **Refonte login** : légère (logo TAP conservé), refonte visuelle complète = phase UI/UX dédiée post-Passe 2.
- **Mode nuit toggle** : cookie httpOnly (next/headers cookies). Pref Supabase = Phase 06+.
- **Comptes démo cliquables** : visibles si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`, prefill email + password sur click.
- **Invitation chauffeur** : magic link Supabase Auth built-in (template SES par défaut). Resend/Brevo = Phase 06+.
- **Spike Wave 1** : Server Action via fetch (Next-Action header) vs Route Handlers `/api/driver/rides/*` — trancher empiriquement avant Wave 2 sync engine.

### Velocity attendue

17-25h discuss → ship complet (4 livrables hétérogènes, 2 lourds : PWA offline + pricing).

### Visible Progress Mandate (CLAUDE.md § 13.5)

5 captures Phase 04 + walkthrough script + seed démo 974 + comptes démo persistants + preview Vercel + UAT manuel design partner sur preview.

### Wave 0 Prérequis (avant tout code Phase 04)

- 10 captures showcase Phase 03 placeholders → captures réelles (CONCERNS.md test coverage gap)
- `CONVENTIONS.md` : documenter (a) classes Tailwind hauteur = échelle default rem + (b) Radix Dialog inert siblings → pas portalId externe
- `STATE.md` : Phase 03.2 shipped (PR #47..#55), Phase 03.1.1 ROADMAP marquée livrée hors GSD ou supprimée
- `PROJECT.md` decisions bloc : DEC-017, DEC-018, DEC-019, ADR-003
- `pnpm db:types` → suppression 5 `TODO(types)` du code Phase 03

</specifics>

<deferred>
## Deferred Ideas

### Reportées Passe 4 (Phase 06)

- Hors-ligne > 1 heure
- CGSS long trajet, suppléments TPMR, attente
- Push notifications Web Push API (VAPID)
- Géolocalisation temps réel chauffeur
- OSRM auto-hébergé (remplace external Phase 04)
- Script batch reverse-geocoding courses pré-Phase-04 (si volume justifie)
- Resend / Brevo email transactionnel (remplace Supabase Auth SES default)
- Pref Supabase `users.theme_preference` (remplace cookie httpOnly mode nuit)

### Reportées Passe 3 (Phase 05)

- Cache PWA régulateur (`/courses`)
- Récurrences dialyse (`packages/recurrence`)
- Cockpit régulateur Realtime
- SMS rappel J-1 / J-2h via Twilio

### Reportées Phase UI/UX dédiée (post-Passe 2)

- **Polish UI/UX modal saisie course** (CONCERNS.md ligne 197 — verrou explicite Phase 04) : proportions Mode/Urgence, espacement vertical, asymétrie icônes date/heure
- Refonte visuelle complète `/login` `/welcome` `/setup` (charte, baseline, splash, identité forte au-delà du logo TAP existant)
- TTS lecture vocale au démarrage course (présent dans ROADMAP esquisse, retiré du scope enrichi)

### Reviewed Todos (not folded)

Aucun — `gsd-sdk query todo.match-phase 04` retourne 0 matches.

</deferred>
