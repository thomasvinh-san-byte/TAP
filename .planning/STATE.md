---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Between phases — Phase 03 mergeable, Phase 04 à discuter/planifier
stopped_at: (between_phases — Phase 03 close, Phase 04 ready to discuss)
last_updated: "2026-05-12T06:52:00.722Z"
last_activity: 2026-05-12 — ROADMAP réécrite via /gsd-ingest-docs (manifest 3 SPECs)
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 23
  completed_plans: 23
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06)

**Core value:** La régulatrice doit avoir envie d'utiliser l'outil 8 h/jour, 220 j/an, sans jamais le subir.
**Current focus:** Phase 03 close (validation manuelle dirigeant en attente) — Phase 04 (PWA + tarif CGSS auto) à planifier.

## Current Position

Phase: 03 (E2E Passe 1 — Squelette + clôture-bis) — CODE COMPLETE, walkthrough pending
Phase next: 04 (E2E Passe 2 — PWA + tarif CGSS auto + caisse + refonte login)
Status: Between phases — Phase 03 mergeable, Phase 04 à discuter/planifier
Last activity: 2026-05-12 — ROADMAP réécrite via /gsd-ingest-docs (manifest 3 SPECs)

Progress: [██████████] 100%

Phases livrées :

- Phase 0   — Fondations Lot 0 (2026-05-06)
- Phase 1   — Référentiel patients (2026-05-06)
- Phase 1.5 — DPA + RGPD compliance
- Phase 0.7 — Déploiement continu Vercel + démo seedée (2026-05-07)
- Phase 2   — Saisie express course (2026-05-07)
- Phase 03  — E2E Passe 1 squelette + clôture-bis (2026-05-12)

Phases à venir :

- Phase 04 — E2E Passe 2 (PWA + tarif CGSS auto + caisse + refonte login)
- Phase 05 — E2E Passe 3 (récurrences + cockpit + SMS)
- Phase 06 — E2E Passe 4 (HDS + OR-Tools + B2B + facturation)

## Performance Metrics

**Velocity:**

- Phases livrées V1 (avant pivot GSD) : 6 (en 6 jours, 2026-05-06 → 2026-05-12)
- Plans formels GSD complétés : 0 (pré-migration, livraison via prompts manuels CCWeb)
- Average duration : n/a (méthode pré-GSD)
- Total execution time : n/a

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 0     | n/a (livré hors GSD)            | n/a | n/a |
| 1     | 5 (livrés en 16 commits)        | n/a | n/a |
| 1.5   | 7 (livrés en 28 commits)        | n/a | n/a |
| 0.7   | n/a (livré hors GSD)            | n/a | n/a |
| 2     | 6 (livrés en 22 commits)        | n/a | n/a |
| 03    | n/a (sous-blocs 03-A à 03-cloture-bis) | n/a | n/a |

**Recent Trend:** Pas encore de données vélocité GSD. La Phase 04 sera
la première planifiée via `/gsd-plan-phase`.

*Updated after each plan completion.*
| Phase 03.1 P01 | 12 | 2 tasks | 5 files |

## Accumulated Context

### Roadmap Evolution

- Phase 03.1 inserted after Phase 03: Efficience saisie modal course — 3 patterns Doctolib/Uber Health/Onfleet (smart defaults, chips date, détection doublon) + re-seed patients fictifs (URGENT)

### Decisions

16 décisions verrouillées dans PROJECT.md (DEC-001 à DEC-016) — 2 ADRs
formels + 14 décisions élevées par autorité du propriétaire projet sur
CLAUDE.md. ADR-003 (pivot E2E par passes) est LOCKED dans `docs/adr/`
mais pas encore listé dans le bloc PROJECT.md `<decisions>` — à ajouter
en Phase 06 lors du nettoyage HDS.

Décisions affectant le travail courant :

- Phase 03 (close) : DEC-005 (saisie < 30 s respectée), DEC-014 (boutons chauffeur ≥ 56px), DEC-015 (recherche fuzzy 2 car), DEC-016 (logique métier en packages)
- Phase 04 (next) : DEC-007 (chiffrement NIR si carry-over PWA), DEC-008 (consentement SMS — préparation Passe 3), DEC-013 (couverture pricing 100%), DEC-014 (PWA hors-ligne)
- [Phase ?]: D-A2-1 silent prefill — aucun startTransition autour de getPatientRideDefaultsAction (checker W6)

### NFR (Non-Functional Requirements transverses)

6 NFR ajoutés en REQUIREMENTS.md (run ingest 2026-05-12) :

- NFR-001 : neutralité absolue (aucun nom propre)
- NFR-002 : ton sobre (pas d'émojis, pas de tutoiement amical)
- NFR-003 : spacing scale strict 4/8/12/16/24/32/48/64
- NFR-004 : identité visuelle (bleu primaire + accent terracotta + Inter tnum + Lucide)
- NFR-005 : états interactifs et animations standard (5 états, 150ms)
- NFR-006 : double goal par passe E2E (fonctionnel + UX)

### Pending Todos

- Validation manuelle dirigeant Phase 03 (walkthrough 16 étapes — voir `.planning/phases/03-e2e-passe1-squelette/03-SUMMARY.md`)
- Production des 10 captures Visible Progress dans `docs/showcase/03-e2e-passe1-squelette/` (placeholders en place)
- Câblage skill `tap-neutralite` dans `.planning/config.json` (note inline dans config.json)

### Blockers/Concerns

- **CDC v2 binaire `.docx`** : 15 modules secondaires non extraits ; à reconvertir en `.md` puis ré-ingérer pour enrichir REQUIREMENTS.md (non bloquant V1, à anticiper avant Phase 06).
- **HDS** : Supabase Cloud non certifié HDS — bêta privée acceptable sous DPA, migration vers OVHcloud / Scaleway HDS prévue Phase 06 (cf. CON-001).
- **Verification debt Phase 01** : 5 items audit-uat pending (`/gsd-audit-uat`). Dette transverse, à régler avant Phase 07 commercialisation, NON bloquante pour Phases 04/05/06.

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

## Session Continuity

Last session: 2026-05-12T06:51:56.070Z
Stopped at: (between_phases — Phase 03 close, Phase 04 ready to discuss)
Resume file: None
Next command suggested: /gsd-discuss-phase 03.1

## Ingest Runs

| Run | Date | Mode | Sources | Bloc | Warn | Info |
|-----|------|------|---------|------|------|------|
| 1   | 2026-05-11 | new   | 5 docs (2 ADR, 3 DOC) | 0 | 0 | 3 |
| 2   | 2026-05-12 | merge | 3 docs (3 SPEC)       | 0 | 1 | 3 |

Run 2 résolu : ROADMAP réécrite (CDC numbering → E2E passes numbering aligné ADR-003) après approval utilisateur sur le WARNING désalignement structurel.
