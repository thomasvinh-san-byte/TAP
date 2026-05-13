# Phase 04 — Discussion Log (Assumptions Mode + Pre-Posed Answers)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `04-CONTEXT.md` — this log preserves the analysis.

**Date :** 2026-05-13
**Phase :** 04-e2e-passe2-pwa-tarif
**Mode :** assumptions + meta pré-réponses dirigeant
**Areas analyzed :** Service Worker & PWA, Offline Queue & Sync, Pricing CGSS + Distance, Caisse Page, Refonte Login, Workflow Invitation Chauffeur, Architecture (RHF + découpes)

---

## Assumptions présentées (par agent `gsd-assumptions-analyzer`)

### 1. Service Worker & PWA Architecture
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Hand-rolled SW dans `apps/web/public/sw.js` + manifest static + registration manuelle dans `(driver)/layout.tsx`. No `next-pwa`, no Workbox. | Likely | `apps/web/package.json` zéro deps PWA, `next.config.mjs` minimaliste, `(driver)/layout.tsx` shell isolé |

### 2. Offline Mutation Queue
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Raw IndexedDB wrapped in tiny helper, single object store `pending_mutations`, replay via SW `sync` event → fetch sur Server Actions URL. | **Unclear** | Bias CLAUDE.md § 3 no deps, mutations = 2 (`startRideAction`, `endRideAction`), Server Actions invocation from SW non documenté |

### 3. Pricing Package + Distance
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `packages/pricing` workspace + `computeCgssShortTrip` pure + **Haversine sur lat/lng BAN** (pas d'OSRM externe V1) | Likely | `tarif_source: 'cgss_auto'` enum déjà prévu, `AddressPickerField` reçoit lat/lng mais ne persiste pas (D-ADDR-06), Haversine ±5-10% suffisant île 70km |

### 4. Caisse + Login Refonte
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `/courses/caisse` Server Component + `_lib/queries-caisse.ts`, table grouped by `driver_id`, CSV Server Action `text/csv` Response | Confident | Pattern `_lib/queries-enriched.ts` canonique |
| `<AuthShell>` extracted dans `(auth)/_components/`, layout split, `DemoCredentials` converti client cliquable, dark mode tokens déjà en place | Confident | `tailwind.config.ts` darkMode + `globals.css` `[data-theme='dark']` tokens existants, 3 auth shells dupliqués |

---

## Corrections Made (par dirigeant via meta pré-réponses)

### Service Worker & PWA — OVERRIDÉ
- **Original assumption :** Hand-rolled SW < 200 LOC
- **User correction (DEC-019) :** **Serwist** (successeur officiel `next-pwa` et `@ducanh2912/next-pwa`, recommandé doc Next.js 2026, basé Workbox). Config via `withSerwistInit` dans `next.config.ts`.
- **Reason :** Recherche état de l'art 2026 effectuée (Next.js docs officielles, LogRocket Jan 2026, Medium Apr 2026, PkgPulse Mar 2026). Serwist mature, déclaratif, intègre proprement App Router. `reloadOnOnline: false` obligatoire (sinon perte saisie). `disable: NODE_ENV === 'development'` (DX).

### Offline Queue Mechanism — OVERRIDÉ
- **Original assumption (Unclear) :** Raw IndexedDB wrapped, replay via SW sync event
- **User correction (DEC-019) :** **Dexie 4.x** comme source de vérité PWA chauffeur. React Query disparaît de `/conduite`, queries Supabase miroirées dans Dexie.
- **Reason :** 3 raisons concrètes : (a) `useLiveQuery` réactif pour badge "N mutations en attente", (b) migrations versionnées déclaratives `db.version(2).stores`, (c) ~3M DL/sem, TypeScript-first, mature. Coût 30KB vs 5KB raw IDB négligeable.

### Pricing Distance — PARTIELLEMENT OVERRIDÉ
- **Original assumption :** Haversine primary V1 (no OSRM)
- **User correction :** OSRM **externe primary** (`router.project-osrm.org` gratuit V1, 5000 req/jour) + **Haversine fallback** si offline / OSRM down. Self-host OSRM = Phase 06.
- **Reason :** Précision route réelle meilleure pour SC #3 ±0,01 €, surtout Cilaos/Salazie. Quota public suffisant design partner unique. Fallback Haversine garde la robustesse offline.

### Server Action vs Route Handler depuis sync engine — DÉLÉGUÉ AU PLANNER
- **Original assumption (Unclear) :** Replay via fetch sur Server Action URL avec Next-Action header
- **User answer (D-09) :** Tenter Server Actions d'abord, fallback Route Handlers si échec/flaky. **Spike Wave 1 dédié pour trancher empiriquement**.
- **Reason :** Question technique sans réponse vision-side. Le planner inclura le spike comme tâche Wave 1 avant Wave 2 sync engine.

---

## Décisions ajoutées par le dirigeant (hors assumptions agent)

### DEC-017 — Découpage Phase 04 monolithique E2E
- ADR-003 (2026-05-11) impose pivot E2E par passes successives. Splitter 04-A/04-BCD = retour au modèle modulaire vertical.
- Vélocité Phase 03.1 (~5h) → extrapolation 17-25h pour 4 livrables hétérogènes Phase 04.
- Plan formel en 5-7 plans répartis sur 6 vagues (W0..W6).

### DEC-018 — React Hook Form Phase 04+
- RHF déjà installé (dette CONCERNS.md), formulaires Phase 04 plus complexes (clôture course, override tarif, caisse filters, login refonte, accept-invite).
- RHF + zodResolver standardise validation client/serveur sur schémas Zod existants `packages/shared`.
- Server Actions conservées côté submit.
- Pas de migration rétroactive Phase 1/2 (sauf si touché pour autre raison).

### Périmètre étendu (hors esquisse initiale)
- Workflow invitation chauffeur (magic link Supabase + `/accept-invite`)
- Découpe `ride-express-modal` (384L) + `ride-drawer` (337L) — dette CONCERNS.md
- Filtrage type_permis ↔ vehicle.type modal assignation — dette CONCERNS.md
- Audit logs nom acteur (prénom/nom au lieu de "regulateur") — dette CONCERNS.md
- Régénération types Supabase + suppression des 5 `TODO(types)` — dette CONCERNS.md

### Verrous explicites
- **Polish UI/UX modal saisie course INTERDIT Phase 04** (CONCERNS.md ligne 197). Phase UI/UX dédiée post-Passe 2.
- Refonte visuelle complète `/login` (au-delà du layout split) = phase UI/UX dédiée post-Passe 2.
- TTS lecture vocale au démarrage course (présent ROADMAP esquisse) — retiré du scope enrichi.

### Wave 0 Prérequis (avant code)
- 10 captures showcase Phase 03 (Visible Progress § 13.5)
- CONVENTIONS.md : 2 apprentissages Phase 03.2 (Tailwind `h-*` rem default, Radix Dialog inert siblings)
- STATE.md : Phase 03.2 shipped (PR #47..#55), Phase 03.1.1 ROADMAP marquée livrée hors GSD ou supprimée
- PROJECT.md decisions bloc : DEC-017, DEC-018, DEC-019, ADR-003
- `pnpm db:types` → suppression 5 `TODO(types)`

---

## Spécifiques techniques (préposés par dirigeant)

| Décision | Choix |
|----------|-------|
| Cache PWA scope | `/conduite*` chauffeur uniquement |
| Conflits sync | LWW partout sauf paiement (server-wins) + audit_logs INSERT-only |
| Source vérité PWA | Dexie côté chauffeur ; React Query reste sur régulateur `/courses` |
| Queue model | 1 mutation = 1 ligne, retry exp 2s+jitter, max 30s, 3 essais, puis DLQ + toast |
| Distance | OSRM externe + Haversine fallback |
| OSRM endpoint V1 | router.project-osrm.org gratuit |
| Migration BDD | `rides.pickup_lat/lng/citycode` + `dropoff_*` nullable, rétrocompat |
| Backfill géocoding pré-04 | Null laissé V1, batch reverse-geocoding = Phase 06 si volume |
| Grille CGSS démarrage | 2,60 € forfait + 1,10 €/km court trajet (national) ; 5+ cas design partner ensuite |
| Caisse granularité | Par chauffeur, groupes expandables, sous-totaux + total `<tfoot>` |
| CSV export | UTF-8 BOM (U+FEFF) + `;` + date jj/mm/aaaa pour Excel FR |
| Permissions caisse | Régulateur + dirigeant uniquement, chauffeur exclu via RLS |
| Login identité | Logo TAP existant conservé, refonte légère seulement |
| Mode nuit toggle | Cookie httpOnly (next/headers cookies) ; pref Supabase = Phase 06+ |
| Comptes démo | Cliquables prefill si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'` |
| Invitation chauffeur | Magic link Supabase Auth built-in (SES default), `/accept-invite?token=...` |
| Email transactionnel | Resend/Brevo = Phase 06+ (V1 = SES Supabase default) |
| RHF migration | Tous nouveaux formulaires Phase 04+, pas de rétroactif |
| Découpe `ride-express-modal` | <200L orchestrateur (extraire HeaderBar, ActionsBar, NotesField) |
| Découpe `ride-drawer` | <200L (extraire 7 sections : DrawerHeader, TrajetSection, ModeSection, AssignationSection, ExecutionSection, PaiementSection, HistoriqueSection) |

---

## Plan probable (W0..W6, 6 vagues)

- **W0** : Prérequis (showcase + docs CONVENTIONS + STATE + DEC PROJECT.md + types regen)
- **W1** : Serwist scaffold + Dexie schema + manifest icônes + **spike D-09**
- **W2** : Sync engine + indicateurs UI + RHF migration formulaires
- **W3** : `packages/pricing` (100% Vitest) + migration BDD géocoding rides
- **W4** : `/courses/caisse` + refonte `/login` (AuthShell + DemoCredentials clickable + cookie mode nuit) + workflow invitation chauffeur
- **W5** : Découpe `ride-express-modal` + `ride-drawer` + type_permis filtering + audit_logs nom acteur
- **W6** : E2E Playwright PWA offline + UAT preview Vercel

## Velocity attendue

**17-25h** discuss→ship complet (4 livrables hétérogènes, 2 lourds : PWA offline + pricing).

## Visible Progress Mandate (5 captures Phase 04)

1. PWA installée écran d'accueil iPhone (capture mobile réelle)
2. Course clôturée en mode avion + indicateur sync
3. Tarif CGSS auto à la clôture avec breakdown km/forfait
4. `/courses/caisse` avec totaux journée
5. `/login` refonte split jour + nuit (2 captures = compté pour 1)

---

## External Research

Non-spawn par l'orchestrateur — recherche état de l'art 2026 sur PWA Next.js (Serwist vs alternatives) **déjà effectuée par le dirigeant** en amont (Next.js docs officielles, LogRocket Jan 2026, Medium Apr 2026, PkgPulse Mar 2026 cités dans le meta brief). Conclusion encodée dans DEC-019.

3 topics needs_research signalés par l'agent mais non lancés :
1. **iOS Safari PWA 2026 quirks** — déléguée à Wave 1 (test empirique sur iPhone réel par design partner)
2. **CGSS forfait court trajet 974 grille numérique** — déléguée au design partner (5+ cas de référence à fournir)
3. **Server Actions invocation from SW** — déléguée au planner via spike Wave 1 (D-09)
