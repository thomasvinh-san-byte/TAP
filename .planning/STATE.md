---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Phase 06.54 livrée localement (formulaires spécialisés — patron de form respectueux : tarifs, sms, legal). PR à ouvrir."
last_updated: "2026-06-09T18:30:00.000Z"
last_activity: Phase 06.54 (application respectueuse du patron de form 06.51 aux formulaires spécialisés ; logique/validation/Server Actions/mécaniques INCHANGÉES, 0 migration, 0 dépendance). Achève l'harmonisation des formulaires CRUD. Les formulaires spécialisés restaient en style ad hoc (space-y-12/16, classes brutes, selects h-32, textareas brutes sans anneau de focus). D-01 enveloppe harmonisée écran par écran : FormSection (groupes) / FormRow (champs liés) / FormActions (barre d'action), champs ui/* (Textarea à anneau de focus, selects natifs au gabarit Input h-10 via NATIVE_SELECT_CLASS). SMS (template-editor) : section Variables en kicker + FormActions ; insertion {{…}} (textareaRef/caret) + compteur MAX_LENGTH=160 + aperçu INCHANGÉS ; compteur annoncé aria-live + aria-describedby. Tarifs (tariff-edit-sheet) : patron DANS le Sheet (Header/Content/Footer conservés), NumberField prix/€ + simulateur (fichier séparé) intacts ; 2 sections. Legal : dpia-form (3 sections), dpo-form (FormSection+FormActions), breach-drawer (4 sections) + breach-form-fields (SelectField partagé h-32→h-10) ; libellés RGPD inchangés (DPIA, périmètre, risque résiduel, Article 33…). D-02 règle valeurs métier : structure harmonisée, valeurs (variables SMS, termes tarifaires, vocabulaire légal) conservées. D-03 mécaniques spéciales intactes ; patron 06.51 réutilisé tel quel. text-emerald-700→text-success (token). Hors périmètre : requests/registre (h-32 résiduels), cockpit/optimisation, chauffeur mobile, pages texte légales, utilitaires. Tous fichiers ≤300 LOC. typecheck+lint(0 err, 9 warn)+build verts, 129 web. Artefact docs/showcase/06.54-form-restants/. DEC-133 LOCKED.
last_activity_prev: Phase 06.53 (patron de liste unifié — toolbar + pagination + actions). DEC-132 LOCKED.
# Comptage des phases (recompté 2026-06-08) : la roadmap est vivante, le dénominateur
# fixe historique « 38 » est obsolète. completed_phases = identifiants de phase numérotés
# marqués [x] dans ROADMAP — socle produit+technique (30) + phases individuelles livrées
# ensuite (06.20-06.23 pré-prod + 06.24-06.39 = 50) + 06.41 messagerie + 06.42 fix overlays
# + 06.43 fix cible cliquable + 06.44 refonte login + 06.45 login centré + 06.46 fix focus ring
# + 06.47 calibrage focus + 06.48 bouton auth aligné + 06.49 dashboard densité + 06.50 conformité
# densité + 06.51 form patient patron + 06.52 form véhicule/chauffeur + 06.53 patron de liste
# + 06.54 form spécialisés = 64. (06.40 = lot d'hygiène docs, hors compte feature ; 06.45 supersede
# 06.44 mais les 2 ont été livrées.) Restantes réelles = Phase 09 (HDS) + Phase 10 (géoloc réelle)
# = 2. Phase 07 abandonnée (DEC-092) hors compte.
# Dernière phase livrée : 06.54. Dernier DEC : 133 (06.54). Dernier ADR : ADR-013 (06.33).
progress:
  total_phases: 66
  completed_phases: 64
  total_plans: 89
  completed_plans: 89
  percent: 97
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06) + .planning/VISION.md (créé 2026-05-14)

**Core value:** La régulatrice doit avoir envie d'utiliser l'outil 8 h/jour, 220 j/an, sans jamais le subir.
**Current focus:** Phase 06.54 livrée localement (formulaires spécialisés — patron de form respectueux : sms-templates, tarifs, legal dpia/dpo/breaches ; mécaniques métier intactes). Achève l'harmonisation des formulaires CRUD. 64 phases livrées (cf. commentaire de comptage dans le frontmatter). Restantes : Phase 09 HDS + Phase 10 géoloc réelle ; migration listes drivers/caisse/tarifs/legal (mécanique) + étapes restantes du plan d'audit (cockpit/optimisation, chauffeur mobile, pages texte légales, utilitaires) + messagerie lots photo/push/fil général à venir.

## Current Position

**Dernière mise à jour** : 2026-06-04 (cadrage Phase 06.14 lancé)
**Phase courante** : Phase 06.18 « Page de connexion — champs + UI aux normes » livrée localement (cadrage + exécution dans une seule PR). Entrée ROADMAP posée [ ]. Sync STATE après merge.
**Optimizer status** : `OPTIMIZER_USE_MOCK=true` en production et preview (décision dirigeant 2026-06-03). Le mock produit des groupements 2-par-2 cohérents avec le contrat zod, l'enrichissement Wave 4 fonctionne (libellés véhicules, adresses lisibles). Réactivation vrai solveur reportée à Phase 06.12 candidate (renumérotée depuis 06.11, cf. DEC-085).
**Géocodage** : pipeline UI→DB fonctionnel depuis Phase 04.7 (DEC-044), scellé par tests Vitest PR #211. Les courses créées via UI avec sélection BAN/Géoplateforme persistent leurs 6 colonnes lat/lng/citycode.

Phase: 06.54 livrée localement (2026-06-09) — formulaires spécialisés sur le patron de form (respectueux). PR à ouvrir.
Phase next: migration listes drivers/caisse/tarifs/legal (mécanique, mêmes composants) ; étapes restantes du plan d'audit (cockpit/optimisation, chauffeur mobile, pages texte légales, utilitaires) ; messagerie lots photo (HDS)/push (VAPID)/fil général ; Phase 09 HDS + Phase 10 géoloc réelle.
Status: 64 phases livrées. Patron de form appliqué à TOUS les formulaires CRUD (patient/véhicule/chauffeur + sms/tarifs/legal). Application respectueuse : enveloppe harmonisée (FormSection/Row/Actions, champs ui/*) SANS toucher aux mécaniques métier (insertion SMS, compteur 160, simulateur tarifs, Sheet, libellés RGPD). Données/validation/SA inchangées.
Blockers: aucun
Last activity: Phase 06.54 — patron de form aux formulaires spécialisés (respectueux). D-01 enveloppe : FormSection/FormRow/FormActions, Textarea (anneau focus), selects natifs h-32→h-10 (NATIVE_SELECT_CLASS). SMS : insertion {{…}} + compteur 160 + aperçu INTACTS, compteur annoncé aria-live. Tarifs : patron DANS le Sheet, NumberField prix/€ + simulateur intacts. Legal : dpia (3 sections), dpo, breaches (4 sections) + breach-form-fields ; libellés RGPD inchangés. D-02 valeurs métier préservées (variables SMS, termes tarifaires, vocabulaire légal). D-03 logique/mécaniques inchangées, patron 06.51 réutilisé tel quel. Hors périmètre : requests/registre, cockpit, chauffeur mobile, pages texte, utilitaires. ≤300 LOC. typecheck+lint+build verts, 129 web. Artefact docs/showcase/06.54-form-restants/. 0 migration, 0 dépendance. DEC-133 LOCKED. PR à ouvrir.
Précédent: 06.53 patron de liste unifié (DEC-132), 06.52 form véhicule/chauffeur (DEC-131), 06.51 form patient (DEC-130).

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

DEC-095 (2026-06-05, Phase 06.9) — Next.js 14.2 → 15.5 + migration async complète des Request APIs. React 18 conservé (R19 différé, ADR-007). `createClient` Supabase serveur passe **async** (84 sites consommateurs migrés `await createClient()`), 0 cast `UnsafeUnwrapped*` (interdits). `lib/geocoding/ban.ts` : `fetch(url, { cache: 'no-store' })` explicite (D-04). `typedRoutes` activé (stable 15.5). Rewrite `/api/solver` mort purgé (orphelin Phase 06.12, ADR-010). `next-mdx-remote` downgradé 6→5 + bascule `compileMDX` → `<MDXRemote>` + `force-dynamic` sur `/legal/*` (incident SSG résolu). ESLint au build conservé désactivé (nettoyage CI séparé, D-08). ADR-011 acte la décision et complète ADR-007.

DEC-102 (2026-06-05, Phase 06.24) — Incarnation de la direction artistique (DEC-101) sur Régulation, **lot 1** : (a) `PageHeader` unifié sur 6 écrans (`cockpit`, `courses`, `courses/caisse`, `patients`, `patients/[id]`, `tableau-de-bord`) ; titres humains, descriptions et actions (boutons, badge Realtime) préservés EXACTEMENT ; remplacement 1:1 du `<h1 className="text-2xl font-semibold tracking-tight">` manuel. (b) **Hiérarchie typographique exprimée** : gradation visible titre page 2xl > titre panneau base > kicker section xs uppercase tracking-wide > body sm > légende xs. 6 fichiers patients harmonisés sur pattern kicker (`patient-form-*`, `patient-drawer-sections`, `recurrences-section`, `patients/[id]/page.tsx`). `alerts-panel` cockpit aligné. Réutilise l'échelle typo et le PageHeader existants — aucune nouvelle abstraction. Lots suivants : couleur signature (lot 3 terracotta), skeletons/empty-states (lot 4), refactor cohérence (lot 5), rangement à arbitrer en contexte (lot 6). Pas d'ADR.

DEC-100 (2026-06-05, Phase 06.23) — Audit complet DEC-041 sur 24 Server Actions à mutations. **11 vrais trous comblés** (`(auth)/accept-invite` x2, `courses/assignment` x3, `courses/payment`, `legal/dpia`, `legal/breaches`, `legal/dpo`, `legal/requests` x2, `legal/_actions/cgu-accept`) + 1 confirmation déjà fait (sms-templates) + 2 N/A documentés (`setup/actions` = string ops, `(public)/legal/request/[token]` = service_role bypass). Pattern `.select('id')` + check `data.length === 0` + message « refusée — droits insuffisants ». **Tests métier ciblés** sur angles morts mesurés (`pnpm exec vitest run --coverage`). 3 fichiers / 11 nouveaux tests : `solve-local.edge-cases` (1 course, extension n=3, capacity dépassée, TPMR rejeté), `geocode-safety-net.edge-cases` (coords sans citycode, BAN citycode vide), `scrub.edge-cases` (tableau, query_string, request.data, récursion profondeur 6, primitives). Couverture branches : `geocode-safety-net` 84.61 → **100 %**, `scrub` 61.29 → **77.14 %**, `solve-local` 90.74 → **92.42 %**. `@tap/pricing` + `@tap/recurrence` 100 % maintenus. 1 nouvelle devDep `@vitest/coverage-v8`. **Clôt la dette DEC-041 reportée Phase 06.** Pas d'ADR.

DEC-099 (2026-06-05, Phase 06.22) — Error boundaries par segment. 5 segments majeurs (`(app)`, `(admin)`, `(auth)`, `(public)`, `(driver)`) + 2 sous-segments critiques (`(app)/cockpit`, `(driver)/conduite`) couverts par un gabarit commun `<SegmentError>` (`components/error/segment-error.client.tsx`) qui : capture l'erreur dans Sentry au mount avec tag `segment`, affiche une UI dégradée `role="alert"` + `aria-live="assertive"` + `autoFocus` sur le bouton Réessayer, montre la stack UNIQUEMENT en dev via `<details>` (jamais en prod — CLAUDE.md §6). Bouton Réessayer = `reset()` Next 15 (re-render local, **0 dépendance réseau** — fonctionne offline côté PWA chauffeur). Message `/conduite` rassure sur la file offline (sync engine 04.9 — pointages sauvegardés sur l'appareil). Upgrade `tableau-de-bord/error.tsx` vers le gabarit (capture Sentry ajoutée). 5 tests Vitest. Pas d'ADR (activation pattern Next 15).

DEC-098 (2026-06-05, Phase 06.21) — Couverture tests RLS étendue de **13 à 24 tables** (les 11 trous comblés). 11 fichiers de test pgTAP ajoutés (`ride_events`, `ride_recurrences`, `ride_recurrence_exceptions`, `cgu_acceptance`, `cookie_consent_log`, `legal_request_attempts`, `tariff_grids`, `sms_messages`, `sms_templates`, `pois_metier`, `holidays_974`). Gabarit `rides_rls.sql` réutilisé (fixtures Org Alpha/Bravo + rôles dirigeant/régulateur/chauffeur). Vérifs : RLS activée, cross-tenant strict, WITH CHECK, isolation par rôle, anon refusé. **0 policy modifiée** (D-04 « détection ≠ correction »). 3 observations `force row level security` non posé tracées en commentaire (`ride_events`, `tariff_grids`, `sms_messages`) — pas des trous de sécurité (rôle `authenticated` ne contourne pas RLS). Renforce DEC-002 / DEC-013. Pas d'ADR (activation d'un choix de qualité acté).

DEC-097 (2026-06-05, Phase 06.20) — Observabilité Sentry activée (stack figée DEC-003). **Zéro PII santé** : `sendDefaultPii: false` sur les 3 runtimes (client/server/edge), scrubbing `beforeSend` partagé (`lib/sentry/scrub.ts`) retire NIR / nom / prénom / adresses / téléphone / email / date_naissance / tokens / cookies / `Authorization` headers ; query strings URL retirées ; user → id auth seul. **Session Replay OFF** (laissé en commentaire avec `maskAllText: true` + `blockAllMedia: true` si réactivé). `onRequestError = Sentry.captureRequestError` pour capter RSC + Server Actions Next 15. `global-error.tsx` root. Init **no-op si DSN absent** (dev local fonctionne). `captureException` ajouté dans `api/optimizer/route.ts` + `lib/geoloc/record-position.ts`. `pnpm.overrides` étendu de `next: 15.5.19` pour dédup Sentry/opentelemetry. **Pas de nouvel ADR** (activation d'un choix acté DEC-003 stack figée).

DEC-096 (2026-06-05, Phase 10.0) — Prototype géoloc sur données fictives, pré-HDS. **Capture événementielle aux pointages** (pas de suivi continu — barrière PWA réelle, RETEX devs : la capture s'arrête dès qu'une app tierce passe en premier plan). **Cockpit = dernière position connue + âge (« vu il y a X min »), JAMAIS faux « live »**. Aucune position simulée animée en démo (positions statiques uniquement). MapLibre + PMTiles fond statique + fallback OSM raster (ADR-012). Table `driver_positions` + RLS + rétention 90j câblée mais pg_cron non activé. Flag `GEOLOC_ENABLED` : pré-HDS = OFF en prod, seules les `source='demo'` du seed persistent. Réversible : la bascule réelle (`GEOLOC_ENABLED=true` + activation pg_cron) se fera en Phase 09 (HDS). Helper client `captureCurrentPosition` non bloquant (8s timeout, accuracy ≤ 100 m, refus permission = pointage OK sans position). Banner consentement chauffeur sur `/conduite`.

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

Last session: 2026-06-05T11:15:00.000Z
Stopped at: Phase 06.40 livrée localement — hygiène .planning + resync tracking + 6 docs de référence. 50 phases livrées (recompté). PR à ouvrir.
Resume file: None
Next command suggested: après merge PR 06.24 → lot 3 incarnation (terracotta sur moments-clés) ou poursuite autres lots (skeletons/empty-states, refactor cohérence, rangement contextualisé) ou décision business Phase 09 HDS.

## Ingest Runs

| Run | Date | Mode | Sources | Bloc | Warn | Info |
|-----|------|------|---------|------|------|------|
| 1   | 2026-05-11 | new   | 5 docs (2 ADR, 3 DOC) | 0 | 0 | 3 |
| 2   | 2026-05-12 | merge | 3 docs (3 SPEC)       | 0 | 1 | 3 |

Run 2 résolu : ROADMAP réécrite (CDC numbering → E2E passes numbering aligné ADR-003) après approval utilisateur sur le WARNING désalignement structurel.
