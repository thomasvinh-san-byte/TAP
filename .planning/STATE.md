---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 04.9 — Wave 6 livrée (code), ready Wave 7 captures + SUMMARY + UAT informel TEMPS 2 dirigeant
stopped_at: Phase 04.9 Wave 6 complete (PR #115) — ready Wave 7 + UAT manuel
last_updated: "2026-05-18T13:30:00.000Z"
last_activity: 2026-05-18 — Wave 6 Phase 04.9 livrée TEMPS 1 (PR #115). 2 tests E2E Playwright créés : driver-offline-flow.spec.ts (login chauffeur démo via helper loginAsRegulateur générique + chauffeur@demo.tap → /conduite → setOffline(true) → check badge offline_idle visible → click Démarrer si dispo → check toast 'Mutation enregistrée' + badge offline_with_queue count → setOffline(false) → check badge disparaît preuve queue vide sync OK) + pwa-install.spec.ts (2 tests : manifest.json shape avec start_url /conduite + scope /conduite/ + display standalone + orientation portrait DEC-014 + icons >= 4 avec maskable+any Option A, et apple-touch-icon + viewport-fit cover + manifest link + SW state ['activated','no-sw'] tolérant dev ; test 2 : apple-touch-startup-image 3 DPR Option A). Pattern UI au lieu de Dexie direct (PLAN-6 référençait dbModule.db.mutations_queue qui n'existe pas — Wave 3 a livré getDb function pattern + import chunks Next.js hashés fragile en CI). Validation via composants ConnectionStatusBadge + toasts Sonner plus robuste. Helper auth réutilisé (loginAsRegulateur générique accepte n'importe quel email). Flow Démarrer→Terminer offline en chaîne PAS testable Phase 04.9 (état ride.status reste assignee côté serveur sans optimistic UI miroir local). Dette inscrite CONCERNS Phase 06 « Optimistic UI miroir Dexie » avec trade-off complexité rollback+reconcile. typecheck PASS. TEMPS 2 UAT informel 16 checks (8 iPhone + 8 Android Option A cross-platform) à effectuer manuellement par dirigeant après merge sur 2 devices réels. Si frictions remontées → CONCERNS + hotfix-bis si bloquant. Prêt Wave 7 (captures Visible Progress + 04.9-SUMMARY.md + items différés CONCERNS Phase 05/06) après merge + UAT GREEN. Précédent : PR #114 Waves 4+5.

Précédent : 2026-05-18 — Waves 4+5 Phase 04.9 livrées groupées (PR #114). Wave 4 Sync engine : enqueue + flushQueue avec retry exponentiel base 2s + jitter ±500ms + cap 30s + 3 essais max + dead letter status='dead' + toast Sonner destructive. Idempotency UUID v4 crypto.randomUUID client-generated. Hook useSyncStatus (navigator.onLine + Dexie useLiveQuery 2 counts pending+in_flight+failed et dead, isSynching dérivé). Hook useNetworkListener (online event flushQueue + premier flush mount si online). SWRegister étendu (hooks Wave 3+4 combinés). ride-actions.client.tsx + end-ride-modal.client.tsx wrappés online/offline : 4xx erreurs métier toast.error sans enqueue (retry vain), 5xx ou offline → enqueue Dexie fallback + toast warning. Wave 5 UI composants : ConnectionStatusBadge 4 états spec'd UI-SPEC PR #110 intégrés au header (anti-pattern banner full-width respecté) — online_idle RIEN visible, synching primary pulse + RefreshCw rotating, offline_with_queue amber pulse + CloudOff + count, offline_idle muted gris stable + CloudOff. WarningBannerInactivity DEC-022 > 7j IndexedDB avec bouton « Compris » h-56 DEC-014 touch + dismiss permanent flag. Hook useIsStandalone Android matchMedia + iOS navigator.standalone (Option A cross-platform). driver/layout.tsx étendu : pt-safe header (iOS notch / Dynamic Island) + pb-safe main (iOS home indicator) + badge dans header à côté UserMenu + banner top main. globals.css 6 utilities safe-area @layer utilities (pt-safe pb-safe pl-safe pr-safe mt-safe mb-safe, zero-dep env() natif). Adaptation Wave 3 livré : PLAN-4 référençait `import { db }` mais Wave 3 a livré `getDb()` function pattern SSR-safe — tous usages adaptés. Server Actions startRideAction + endRideAction conservées intactes (fallback no-op). Vitest deferred Wave 6 (cohérent W1+W2+W3). typecheck PASS. Prêt Wave 6 (E2E Playwright driver-offline-flow + pwa-install + UAT informel dirigeant 16 checks iPhone+Android). Précédent : PR #113 Waves 2+3.

Précédent : 2026-05-18 — Waves 2+3 Phase 04.9 livrées groupées (PR #113). Wave 2 Assets PWA : manifest.json (portrait-only DEC-014, start_url /conduite, scope /conduite/, theme_color #0944a0 extrait globals.css --primary hsl(217,92%,32%), background_color #ffffff) + 5 icônes PNG (192/512 any + 192/512 maskable + apple-touch-icon-180) + 3 splash iOS DPR (iPhone SE 750x1334, iPhone 13/14 1170x2532, iPhone 15 Pro Max 1290x2796). Génération via sharp + SVG inline (pwa-asset-generator nécessitait Chromium indisponible sandbox). Layout root étendu : Viewport export (width device-width, viewportFit cover, themeColor) + 8 meta tags PWA head (apple-mobile-web-app-capable yes, apple-mobile-web-app-status-bar-style black-translucent, apple-mobile-web-app-title TAP Chauffeur, apple-touch-icon link, manifest link, 3 apple-touch-startup-image media-queried DPR-specific). Wave 3 Serwist 9 + Dexie 4 : 5 deps ajoutées (serwist@^9 + @serwist/next@^9 + @serwist/precaching@^9 + dexie@^4 + dexie-react-hooks@^1). DriverOfflineDb extends Dexie 3 tables (mutations_queue ++id status type resource_id created_at, rides_mirror id status pickup_at synced_at, app_meta key). Singleton getDb() SSR-safe. Hook useServiceWorkerRegister (register /sw.js + navigator.storage.persist() DEC-022 + update app_meta.lastUsedAt). sw.ts Serwist entry point avec NetworkOnly strict sur /api/driver/* (mutations JAMAIS cachées) + defaultCache reste + reference lib WebWorker pour ServiceWorkerGlobalScope. next.config.mjs wrapped withSerwistInit (swSrc src/sw.ts, swDest public/sw.js, reloadOnOnline false, disable en dev). SWRegister composant mount-only intégré driver/layout.tsx pour mount universel /conduite/*. Validation typecheck PASS. Vitest deferred Wave 6 (cohérent W1). Prêt Wave 4 (sync engine queue+retry+dead letter) + Wave 5 (UI composants ConnectionStatus + WarningBanner + DriverShell safe-area) en parallèle. Précédent : PR #112 Wave 1 Route Handlers + idempotency_keys.
progress:
  total_phases: 15
  completed_phases: 4
  total_plans: 24
  completed_plans: 32
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06) + .planning/VISION.md (créé 2026-05-14)

**Core value:** La régulatrice doit avoir envie d'utiliser l'outil 8 h/jour, 220 j/an, sans jamais le subir.
**Current focus:** Phase 04.5 clôturée — démo design partner démontrable. Prêt Phase 04.7 (pricing + caisse + géocoding).

## Current Position

Phase: 04.5 (livrée)
Phase next: 04.7 — pricing + caisse + géocoding
Status: Phase 04.5 livrée — démo design partner démontrable
Blockers: aucun bloquant ; 2 PR en cours de merge (#83 UI patient form, #84 POI picker)
Last activity: 2026-05-15 — Phase 04.5 Wave A (PR #74, fix /conduite + seed glissant) + Wave B.1 (PR #76, RLS chauffeur + DEC-041 row count check) livrées et mergées. Migration RLS appliquée BDD prod (premier test CD post-vague 2 réussi). Validation preview manuelle T1.4 en attente avant démarrage Wave B.2 (PLAN-1 T1.3 E2E driver-workflow-complete). Stratégie CI V1.5 acceptée VISION.md (3 dettes pré-existantes reportées Phase 06 HDS).
Blockers: Validation preview manuelle T1.4 par dirigeant requise avant Wave B.2

Progress: [██████████] 100%

Phases livrées :

- Phase 0    — Fondations Lot 0 (2026-05-06)
- Phase 0.7  — Déploiement continu Vercel + démo seedée (2026-05-07)
- Phase 1    — Référentiel patients (2026-05-06)
- Phase 1.5  — DPA + RGPD compliance
- Phase 2    — Saisie express course (2026-05-07)
- Phase 03   — E2E Passe 1 squelette + clôture-bis (2026-05-12)
- Phase 03.1 — Efficience saisie modal course (2026-05-12, PR #39 — 1ère phase pilotée par GSD)
- Phase 03.2 — Série hotfixes finition (8 hotfixes hors GSD, DateTimeFields react-datepicker + AddressPickerField BAN — PR #47..#55, 2026-05-12/13)
- Phase 04   — Onboarding chauffeur + AuthShell (2026-05-13, PR #59 + 5 hotfixes post-merge PR #60..#67)
- Phase 04.5 — Robustesse régulateur (2026-05-15, PR #71..#87 — 13 mergées, ≈3h45 réel vs 14h estimé, vélocité -73%)
- Phase 04.7 — Pricing mockup + Caisse + Migration géocoding + hotfix-bis + verify (2026-05-15, PR #88..#99 — 11 PR cumulées dont hotfix-bis 04.7-bis + verify-work, ≈1h40 réel total (execute 45min + hotfix-bis 25min + verify 30min) vs 4-5.5h estimé, vélocité -85% confirmée. Méthodologie « pipeline GSD étendu — UAT informel obligatoire » VISION.md PR #97 validée par premier cas concret.)

Phases à venir :
- Phase 04.9 — PWA chauffeur enveloppe (~8-10h)
- Phase 05   — Récurrences + cockpit + SMS + patient absent (~10-15h)
- Phase 05.5 — Tarif CGSS réel (~8-12h)
- Phase 06   — HDS + OR-Tools + B2B + facturation CGSS PDF (~15-25h)
- Phase 07   — Mobile native chauffeur (optionnel, ~25-40h)

## Hotfixes 2026-05-13/14 (Phase 04 post-merge)

| PR | Décision | Sujet |
|---|---|---|
| #59 | — | Phase 04 onboarding chauffeur + AuthShell |
| #60 | DEC-029 | Permissions chauffeurs 4 actions distinctes |
| #61 | DEC-030 | Audit FR cadratins + anglicismes user-facing |
| #62 | DEC-031 | Seed démo étendu (3 chauffeurs + 12 courses) |
| #63 | — | /admin/chauffeurs vide régulateur (cause root schéma) |
| #64+#66 | DEC-032 | CD réconcilié vague 1 + playbook schema_migrations |
| #65 | DEC-033 | Clé React liste inclut champ mutable (4 listes) |
| #67 | — | Push final commit cleanup `47c376b` |

## Performance Metrics

**Velocity:**

- Phases livrées V1 : 9 (en 8 jours, 2026-05-06 → 2026-05-14)
- Plans formels GSD complétés : 10 (Phase 03.1 + Phase 04)
- Phase 04 ratio : 135 min livrés vs 330 estimés (-59%) grâce à pipeline GSD discipliné

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 0     | n/a (livré hors GSD)            | n/a | n/a |
| 1     | 5 (livrés en 16 commits)        | n/a | n/a |
| 1.5   | 7 (livrés en 28 commits)        | n/a | n/a |
| 0.7   | n/a (livré hors GSD)            | n/a | n/a |
| 2     | 6 (livrés en 22 commits)        | n/a | n/a |
| 03    | n/a (sous-blocs 03-A à 03-cloture-bis) | n/a | n/a |
| 03.1  | 5 (GSD pipeline complet, 16 commits + 2 docs) | ~1h execution | ~12 min |
| 03.2  | n/a (8 hotfixes hors GSD)       | n/a | n/a |
| 04    | 5 (GSD pipeline complet, ~135 min execution + 5 hotfixes post-merge) | ~135min | ~27 min |

**Recent Trend:** Phase 04 confirme vélocité GSD à -59% vs estimation. Hotfixes post-merge plus coûteux que cadrage amont (leçon CONCERNS.md) — à minimiser en Phase 04.5.

*Updated after each plan completion.*

## Accumulated Context

### Roadmap Evolution

- Phase 03.1 inserted after Phase 03: Efficience saisie modal course — 3 patterns Doctolib/Uber Health/Onfleet
- Phase 03.1 SHIPPED 2026-05-12 via PR #39
- Phase 03.2 série hotfixes hors GSD (2026-05-12/13)
- Phase 04 onboarding chauffeur SHIPPED 2026-05-13 via PR #59 + 5 hotfixes mergés (PR #60..#67)
- Roadmap consolidée 2026-05-14 : Phases V1.5/V2/V3/V4 structurées avec estimations dans .planning/ROADMAP.md + .planning/VISION.md

### Decisions

16 décisions verrouillées DEC-001..016 (2 ADRs + 14 décisions élevées sur CLAUDE.md).
DEC-017..023 + ADR-003 LOCKED.
19 décisions Phase 03.1 (D-A2/A3/B3/SEED).
DEC-029..033 ajoutées 2026-05-13/14 (hotfixes Phase 04 post-merge) :

- DEC-029 : Sémantique 4 actions chauffeurs (Désactiver/Réactiver/Archiver/Désarchiver)
- DEC-030 : Conventions rédactionnelles FR user-facing (Option β)
- DEC-031 : Seed démo étendu UAT multi-chauffeurs
- DEC-032 : Politique migrations Supabase via CD exclusivement + playbook reconcile
- DEC-033 : Clés React listes composants client incluent champ mutable

DEC-035..039 + DEC-041 LOCKED Phase 04.5 :

- DEC-035 : POI métier (table pois_metier + AddressOrPOIPicker)
- DEC-036 : Masques saisie patient (NIR clé INSEE + villes 974 enum + téléphone Réunion + DatePicker FR)
- DEC-037 : Logging défensif Server Components (pattern PR #63 généralisé)
- DEC-038 : Filtre compatibilité chauffeur ↔ véhicule modal assignation
- DEC-039 : Seed démo glissant ON CONFLICT DO UPDATE (dates relatives idempotentes)
- DEC-041 : Server Action row count check (defense in depth post-RLS update)

DEC-040 candidate (Phase 06 HDS) — Server Actions admin obligatoirement gardées par requireDirigeant/requireAdminOrRegulateur côté serveur (pas seulement RLS) : reportée audit systémique Phase 06.

### NFR (Non-Functional Requirements transverses)

6 NFR ajoutés en REQUIREMENTS.md (run ingest 2026-05-12) :

- NFR-001 : neutralité absolue (aucun nom propre)
- NFR-002 : ton sobre (pas d'émojis, pas de tutoiement amical)
- NFR-003 : spacing scale strict 4/8/12/16/24/32/48/64
- NFR-004 : identité visuelle (bleu primaire + accent terracotta + Inter tnum + Lucide)
- NFR-005 : états interactifs et animations standard (5 états, 150ms)
- NFR-006 : double goal par passe E2E (fonctionnel + UX)

Skill `tap-neutralite` installée + cablée dans agent_skills.* (6 agent-types) — NFR-001/002 enforcement automatique au spawn.

### Pending Todos

- Validation preview Phase 04.5 (3 surfaces UI : AddressOrPOIPicker, formulaire patient masques, modal assignation filtre)
- Captures preview à archiver dans `.planning/phases/04.5-robustesse-regulateur/captures/`
- Démarrage Phase 04.7 (pricing + caisse + géocoding + reprise dettes Phase 04.5 différées)
- Intégration AddressOrPOIPicker dans patient-form `adresse_ligne1` (PR de suivi court post-merge #83 + #84)
- Production des 10 captures Visible Progress Phase 03 dans `docs/showcase/03-e2e-passe1-squelette/` (reportée Phase 04.7)

### Blockers/Concerns

- **RAS bloquant Phase 04.5.** Démo design partner démontrable.
- 2 PR en cours de merge : #83 (Wave C.1 UI patient form) + #84 (Wave C.2 POI métier). Migration `pois_metier` appliquée via `cd.yml` post-merge #84 (DEC-032).
- **CDC v2 binaire `.docx`** : 15 modules secondaires non extraits, à ré-ingérer avant Phase 06 (non bloquant V1).
- **HDS** : Supabase Cloud non certifié HDS — bêta privée acceptable sous DPA, migration vers OVHcloud / Scaleway HDS prévue Phase 06.
- **Verification debt Phase 01** : 5 items audit-uat pending, à régler avant Phase 07 commercialisation.
- **3 dettes CI V1.5 acceptées** (cf. VISION.md « Stratégie CI/qualité V1.5 → V3 ») : Lint ESLint v10 flat config + test SIRET Carrefour Luhn + pgTAP env runner — reportées Phase 06 HDS. 13 PR Phase 04.5 mergées/en merge sur cette baseline.
- **Items différés Phase 04.5 inscrits CONCERNS.md** : T5.2 page `/admin/audit-logs` à créer (Phase 04.7) ; T5.3 + DEC-040 audit Server Actions legal/* sans `require*` (Phase 06) ; D PLAN-6 découpes `ride-modal`/`ride-drawer` + refactor visuel `/admin/chauffeurs` (Phase 04.7+).

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Modules secondaires CDC v2 | 15 modules non extraits | Pending PRD ingest | 2026-05-06 |
| Portail B2B (apps/b2b) | Phase 06 (Passe 4) | Out of scope V1 minimal | 2026-05-06 |
| Planning Gantt drag-and-drop | V2 (post Passe 4) | Reporté pivot E2E v2 | 2026-05-11 |
| Géolocalisation temps réel | V3 | Reporté pivot E2E v2 | 2026-05-11 |
| KPIs dirigeant avancés (drill-down) | V2 | Reporté pivot E2E v2 | 2026-05-11 |
| Conformité réglementaire (alertes carte pro/CT) | V2 | Reporté pivot E2E v2 | 2026-05-11 |
| Exports comptables FEC + Lomaco | V2 | Reporté pivot E2E v2 | 2026-05-11 |
| Beta terrain chauffeur Hauts Réunion | V1.5 (après Phase 06) | Maintenu | 2026-05-06 |
| Mobile native chauffeur (Phase 07) | V4 hypothétique | Décision business retour Phase 04.9 PWA | 2026-05-14 |

## Session Continuity

Last session: 2026-05-15T06:06:00.250Z
Stopped at: Phase 04.5 UI-SPEC approved (6/6 dimensions PASS, 4 recommandations non bloquantes)
Resume file: .planning/phases/04.5-robustesse-regulateur/04.5-UI-SPEC.md
Next command suggested: UAT autonome dirigeant (30-90 min) → `/gsd-discuss-phase 04.5` avec frictions UAT en input

## Ingest Runs

| Run | Date | Mode | Sources | Bloc | Warn | Info |
|-----|------|------|---------|------|------|------|
| 1   | 2026-05-11 | new   | 5 docs (2 ADR, 3 DOC) | 0 | 0 | 3 |
| 2   | 2026-05-12 | merge | 3 docs (3 SPEC)       | 0 | 1 | 3 |

Run 2 résolu : ROADMAP réécrite (CDC numbering → E2E passes numbering aligné ADR-003) après approval utilisateur sur le WARNING désalignement structurel.
