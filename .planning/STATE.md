---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 04.5 livrée — démo design partner démontrable
stopped_at: Phase 04.5 complete — ready Phase 04.7
last_updated: "2026-05-15T09:35:00.000Z"
last_activity: 2026-05-15 — Phase 04.5 clôturée, 11 PR mergées (#71 Discuss, #72 UI-SPEC, #73 Plans, #74 Wave A fix /conduite, #75 amendement T1.4, #76 Wave B.1 RLS chauffeur + DEC-041, #77 stratégie CI V1.5, #79 Wave B.2 E2E driver-workflow-complete, #80 Wave B.3 masques Zod + BAN, #81 Wave C.3 modal assign filtre, #82 Wave C.4 audit perms doc) + 2 PR en cours de merge (#83 Wave C.1 UI patient form, #84 Wave C.2 POI métier + AddressOrPOIPicker). Vélocité globale -73% (≈3h45 réel vs 14h estimé). Démo design partner démontrable (workflow chauffeur fonctionnel + masques RGPD + POI métier + filtre permis/véhicule). Items différés inscrits CONCERNS.md (T5.2 page audit-logs Phase 04.7, T5.3 + DEC-040 audit Server Actions legal Phase 06, D PLAN-6 découpes + refactor Phase 04.7+). Stratégie CI V1.5 maintenue (3 dettes pré-existantes reportées Phase 06 HDS).
status: Phase 04.7 Discuss (checkpoint 1/5) — CD réparé, prêt /gsd-ui-phase 04.7
stopped_at: Phase 04.7 Discuss approved + hotfix seed DEC-039-bis livré
last_updated: "2026-05-15T11:00:00.000Z"
last_activity: 2026-05-15 — Phase 04.7 Discuss livrée (PR #88, CONTEXT + DISCUSSION-LOG + audit codebase intelligent Tronc 4 caduc Tronc 3 simplifié, estimation révisée 4.5-7h / 1.5-2h réel). Hotfix seed DEC-039-bis (ON CONFLICT DO UPDATE exhaustif sur rides) — CD remis vert après 3 fails consécutifs liés à état hybride seed+UAT (violation rides_ended_after_started). Test pgTAP seed_demo_idempotent.sql ajouté pour prévenir récurrence. Prêt /gsd-ui-phase 04.7.
progress:
  total_phases: 15
  completed_phases: 4
  total_plans: 23
  completed_plans: 31
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
- Phase 04.5 — Robustesse régulateur (2026-05-15, PR #71..#84 — 11 mergées + 2 en merge, ≈3h45 réel vs 14h estimé, vélocité -73%)

Phases à venir :

- Phase 04.7 — Pricing + Caisse + Migration géocoding (~6-9h) + reprise dettes différées (D PLAN-6 découpes ride-modal/drawer + refactor /admin/chauffeurs ; T5.2 page /admin/audit-logs ; intégration AddressOrPOIPicker dans patient-form)
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
