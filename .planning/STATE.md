---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Phase 06.19 livrée localement (géocodage récurrences + filet serveur, alimente solveLocal) — PR à ouvrir"
last_updated: "2026-06-04T23:55:00.000Z"
last_activity: Phase 06.19 « Branchement géocodage (récurrences + filet serveur) » cadrée + exécutée. Comble le trou applicatif qui privait `solveLocal` (06.12) des courses récurrentes — dialyse = transport le plus mutualisable. AddressOrPOIPicker dans les 2 modales de récurrence (create + edit), schéma Zod étendu 6 champs coords, persistance template, propagation aux occurrences (helper extrait `lib/recurrence/build-rides-payload.ts`). Filet serveur idempotent + non bloquant `lib/geocoding/geocode-safety-net.ts` consommé par createRideAction + create/updateRecurrenceAction. Backfill étendu aux templates + occurrences futures (3 passes). Message exclusion reformulé + lien `/admin/maintenance`. DEC-094 LOCKED. 0 migration BDD (colonnes déjà existantes), 0 dépendance npm. 101 tests web verts (+11 nouveaux : 6 geocode-safety-net + 5 build-rides-payload).
progress:
  total_phases: 32
  completed_phases: 27
  total_plans: 80
  completed_plans: 80
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06) + .planning/VISION.md (créé 2026-05-14)

**Core value:** La régulatrice doit avoir envie d'utiliser l'outil 8 h/jour, 220 j/an, sans jamais le subir.
**Current focus:** Phase 06.19 livrée localement — géocodage branché sur récurrences + filet serveur, alimente solveLocal (06.12) sur le segment dialyse (cas le plus mutualisable). 27/32 phases livrées (06.19 PR à ouvrir). Candidates ouvertes (4) : 06.9 (Next.js 15), 06.19 (en cours), 09 (HDS), 10 (géoloc).

## Current Position

**Dernière mise à jour** : 2026-06-04 (cadrage Phase 06.14 lancé)
**Phase courante** : Phase 06.18 « Page de connexion — champs + UI aux normes » livrée localement (cadrage + exécution dans une seule PR). Entrée ROADMAP posée [ ]. Sync STATE après merge.
**Optimizer status** : `OPTIMIZER_USE_MOCK=true` en production et preview (décision dirigeant 2026-06-03). Le mock produit des groupements 2-par-2 cohérents avec le contrat zod, l'enrichissement Wave 4 fonctionne (libellés véhicules, adresses lisibles). Réactivation vrai solveur reportée à Phase 06.12 candidate (renumérotée depuis 06.11, cf. DEC-085).
**Géocodage** : pipeline UI→DB fonctionnel depuis Phase 04.7 (DEC-044), scellé par tests Vitest PR #211. Les courses créées via UI avec sélection BAN/Géoplateforme persistent leurs 6 colonnes lat/lng/citycode.

Phase: 06.19 livrée localement (2026-06-04) — Géocodage récurrences + filet serveur, alimente solveLocal. PR à ouvrir.
Phase next: à trancher par le dirigeant. Candidates ouvertes (3 après merge 06.19) : 06.9 (Next.js 15, autonome), 09 (HDS, verrou 1er client payant), 10 (géoloc temps réel, post-HDS). Phase 07 (mobile natif) abandonnée DEC-092.
Status: 27/32 phases livrées. 06.19 dénoue le verrou de l'optimisation sur les courses récurrentes (dialyse = mutualisation maximale). 101 tests web verts (+11 nouveaux).
Blockers: aucun
Last activity: Phase 06.19 cadrée + exécutée (AddressOrPOIPicker dans les 2 modales récurrence + persistance template + propagation occurrences + filet serveur BAN + backfill étendu). DEC-094 LOCKED. PR à ouvrir.
Précédent: Phase 06.12 solveur heuristique TS natif (#235), audit planning (06.11 + 06.18 cochées + abandon 07 DEC-092 + total_phases 31), 06.18 page login (#233).

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
- Phase 06.7 Wave 1 — Microservice Python OR-Tools `services/optimizer` (2026-05-27, PR #185 + #186 — 14 fichiers Python, 11/11 pytest verts, contrat `CONTRACT_VERSION='1'` figé, DEC-079 hébergement différé, DEC-082 workaround OR-Tools 9.15, DEC-083 contrat à synchroniser Wave 2)
- Phase 06.7 Wave 2 — Client TS `@tap/optimizer-client` (2026-06-01, PR #188 — 10 fichiers TS, 24/24 Vitest verts, 100% stmts/funcs/lines + 96% branches, parité contrat TS↔Python confirmée, DEC-083 fermée, DEC-080 inscrite sur la contrainte hook guard-commit)
- Phase 06.6  — Conformité assistée (Espace dirigeant) (2026-05-21, pipeline GSD 5/5 — pré-remplissage RGPD bouton DÉCLENCHÉ, entrées éditables, disclaimers ; registre + DPA réels, DPIA trame, breaches/requests/dpo aide contextuelle)
- Phase 06.8  — Tableau de bord dirigeant (Espace dirigeant) (2026-05-21, pipeline GSD 5/5 — page /tableau-de-bord, 6 KPIs réutilisant helpers Caisse/Facturation, ComplianceCard factuelle, redirection par rôle DEC-071, DEC-072, DEC-073, WCAG 2.2 AA, E2E golden path)
- Phase 06.7 Wave 3 — Cockpit régulateur + Route Handler /api/optimizer (dé-identifié D-08) + assignVehicleAction + écran /cockpit/optimisation + E2E golden path (2026-06-01, PR #192 + fix subséquents #195..#202 ; mock optimizer activé via OPTIMIZER_USE_MOCK=true sur 5 PR infructueuses de fix hébergement Python Vercel — ADR-008 amendée 2026-06-01, DEC-079 reste LOCKED en intention)
- Phase 06.7 Wave 4 — Enrichissement minimal UI écran d'optimisation (2026-06-01, PR #204) — OptimizationProposal étendue rideLabels + vehicles (rétrocompatibles), Route Handler enrichit après solveur (D-08 préservée), 5 composants UI branchés, message d'erreur 'aucune course exploitable' quand exclusions no_coordinates. Lecture A traitée, lecture B reste reportée (dette D3)

Phases à venir (réordonnées 2026-05-22 — état bêta, DEC-077 ; Phase 06.10 cadrée 2026-06-01 comme phase next) :

- Phase 06.10 — Dettes techniques Phase 06.7 (D1 hébergement Python Wave 1 + D2 geocoding Wave 2 ; D3+D4 différées ; ADR-009 LOCKED)
- Phase 06.9 — Modernisation Next.js 15 (autonome, bêta — audit cache fetch(), DEC-076)
- Phase 07   — Mobile native chauffeur (optionnel — décision business)
- Phase 09   — Migration HDS (ex-06.5 ; fin de parcours, pré-prod commerciale, verrou 1er client payant, DEC-077)
- Phase 10   — Géolocalisation opérationnelle temps réel (ex-08 ; après HDS, DEC-075)

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

DEC-082 (06.7-01) — Pre-filtrage fenêtres temporelles remplace AddDisjunction OR-Tools (bad_alloc combinaison Time+PDP+Disjunction) ; comportement observable identique.
DEC-083 (06.7-01) — CONTRACT_VERSION='1' dans SolveRequest+SolveResponse Python (Literal['1']) ; à synchroniser manuellement avec zod Wave 2.

DEC-092 (2026-06-04) — Mobile natif (Phase 07) abandonné. Motif : la PWA Phase 04.9 couvre le périmètre terrain retenu, le coût natif (10×, 25-40 h) n'est pas justifié au stade actuel. Réversible si business case mobile validé ultérieurement. Conséquence Phase 10 (géoloc) : pas de fallback natif, le discuss devra concevoir une solution PWA premier-plan dégradé (capture pendant l'usage actif chauffeur).

DEC-093 (2026-06-04, Phase 06.12) — Solveur d'optimisation réimplémenté en heuristique TS native (cluster-first / route-second) dans `apps/web/src/lib/optimizer/`. OR-Tools / Python / mock / hébergement séparé abandonnés. Motif : volume réel ≤ 500 courses (contrat zod plafonne `rides.max(200)`), OR-Tools calibré 1000+ waypoints = disproportionné ; pour fenêtres temporelles petites + horaires quasi-fixes (dialyse) l'heuristique greedy est quasi-optimale ; indicateurs « estimés » DEC-081. Bénéfice : supprime la seule barrière d'hébergement, zéro coût marginal. Contrat zod `@tap/optimizer-client` inchangé → réversible. ADR-010 supersede ADR-008 + ADR-009.

DEC-094 (2026-06-04, Phase 06.19) — Géocodage branché sur récurrences (`AddressOrPOIPicker` dans les 2 modales create + edit, persistance template `ride_recurrences`, propagation aux occurrences générées) + filet serveur idempotent + non bloquant `geocodeBanSearch` (helper partagé `lib/geocoding/geocode-safety-net.ts`) sur `createRideAction` et `create/updateRecurrenceAction`. Backfill `/admin/maintenance` étendu : pass templates + pass occurrences futures (cohérent cascade DEC-048). Alimente `solveLocal` (06.12) sur le segment dialyse (cas le plus mutualisable). Colonnes coords déjà présentes dans `ride_recurrences` (migration 20260519000001) → **0 migration BDD ajoutée**. OSRM toujours hors périmètre (DEC-056).

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

Last session: 2026-06-04T23:55:00.000Z
Stopped at: Phase 06.19 livrée localement (géocodage récurrences + filet serveur, alimente solveLocal). PR à ouvrir + à attendre merge avant sync STATE final. 27/32 phases livrées (28/32 après merge). Prochaine phase à trancher après merge (06.9 / 09 / 10).
Resume file: None
Next command suggested: après merge PR 06.19 → `/gsd-sync-state` puis `/gsd-discuss-phase <phase choisie>`

## Ingest Runs

| Run | Date | Mode | Sources | Bloc | Warn | Info |
|-----|------|------|---------|------|------|------|
| 1   | 2026-05-11 | new   | 5 docs (2 ADR, 3 DOC) | 0 | 0 | 3 |
| 2   | 2026-05-12 | merge | 3 docs (3 SPEC)       | 0 | 1 | 3 |

Run 2 résolu : ROADMAP réécrite (CDC numbering → E2E passes numbering aligné ADR-003) après approval utilisateur sur le WARNING désalignement structurel.
