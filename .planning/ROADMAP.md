# Roadmap : SaaS TAP Réunion

## Overview

Le produit se construit en **passes E2E successives** (ADR-003) plutôt qu'en
modules verticaux. Chaque passe traverse les 6 maillons métier (patient →
saisie → assignation → exécution → tarification → trace) en améliorant le
minimum partout, jamais un module en profondeur avant que tous existent.

Chaque passe a deux goals parallèles (NFR-006) :
- **Fonctionnel** — ce que l'utilisateur peut faire.
- **UX** — à quoi ça ressemble et comment ça se sent.

Aucun goal ne peut être validé sans l'autre. Le pilier UX prime à chaque
phase : aucun écran ne sort si la régulatrice ne pourrait pas en faire une
capture pour une page d'accueil produit.

Sources de vérité de ce séquencement : ADR-003 (LOCKED) +
`.planning/pivot-e2e-v2-2026-05-11.md` + `.planning/passes-2-3-4-detail.md`.

## Phases

**Numérotation :**
- Phases entières (0, 1, 2…) : milestones planifiés.
- Phases décimales (1.5, 0.7) : insertions infra/légales conservées de
  la roadmap pré-pivot.
- Phases 03-06 : passes E2E v2 (alignement ADR-003).

- [x] **Phase 0: Fondations Lot 0** - Monorepo, RLS multi-tenant, migrations, CI/CD (livré commit `f68b1d2`)
- [x] **Phase 0.7: Déploiement continu Vercel + démo seedée** - Visible Progress Mandate (Vercel preview + seed démo 974 + showcase/ + smoke test cloud) — livrée 2026-05-07
- [x] **Phase 1: Référentiel patients** - Fiche patient avec NIR chiffré, recherche fuzzy, préférences (livré 16 commits, 5/5 SC + 7/7 PAT delivered)
- [x] **Phase 1.5: DPA + RGPD compliance** - Registre traitements, DPA Supabase, DPIA santé, portail droits patient (livré 28 commits, 8/8 DPA delivered)
- [x] **Phase 2: Saisie express course** - Saisie < 30 s, raccourci `Cmd/Ctrl+Shift+K`, brouillons, multi-saisies (livré 22 commits, 6/6 SAIS delivered, 2026-05-07)
- [x] **Phase 03: E2E Passe 1 — Squelette + clôture-bis** - 6 maillons reliés bout-à-bout (chauffeurs/véhicules/assignation/exécution/tarif manuel/encaissement) + édition course + role guards + 48h chauffeur + annulation + CRUD admin (livré 2026-05-12 sur branches `claude/consolidate-phase-3-validation-9Tzax` + `feat/03-cloture-bis-annulation-crud-admin`)
- [x] **Phase 03.1: Efficience saisie modal course** — 3 patterns Doctolib/Uber Health/Onfleet (smart defaults, chips date, banner doublon) + re-seed patients fictifs (livré 2026-05-12 sur PR #39 — 5 plans GSD pipeline complet)
- [x] **Phase 03.2: Série hotfixes finition (hors GSD)** — 8 hotfixes DateTimeFields react-datepicker + AddressPickerField BAN (PR #47..#55, 2026-05-12/13). Pattern incremental hors GSD documenté en CONCERNS.md.
- [x] **Phase 04: Onboarding chauffeur + AuthShell** — Workflow invitation magic link Supabase + AuthShell réutilisable + DemoCredentials cliquables + premier RHF + zodResolver du repo (DEC-018). Livré 2026-05-13 sur PR #59 + 5 hotfixes post-merge (PR #60..#67, DEC-029..033).
- [x] **Phase 04.5: Robustesse régulateur + dette CONCERNS** — Filtrage type_permis↔vehicle.type modal assignation + audit logs nom acteur + découpe `ride-express-modal.client.tsx` (384L) + `ride-drawer.client.tsx` (337L) + types Supabase regen + livraison 10 captures showcase Phase 03 + audit permissions autres modules admin (vehicules, legal/*) + workflow patient absent. **Livré 2026-05-15 (PR #71..#87, ~3h45 réel vs 14h estimé, vélocité -73%).**
- [x] **Phase 04.7: Pricing mockup + Caisse + Migration géocoding** — `packages/pricing` stub DEMO + PricingBreakdown UI + OverrideTarifModal + page `/courses/caisse` style Stripe Balance + export CSV utf-8-sig + migration BDD lat/lng/citycode threadée BAN + anonymisation seed profiles. **Pricing réel reporté Phase 05.5 (DEC-021). Livré 2026-05-15 (PR #88..#99). Dette ouverte : pipeline geocoding au moment création course (DEC-044) — colonnes `pickup_lat/lng/citycode` créées mais aucun appel automatique BAN/POI à la création de course. Bloquant validation métier OR-Tools (cf. `docs/dette-technique/2026-06-01-phase-06.7-cloture.md`).**
- [x] **Phase 04.9: PWA chauffeur enveloppe** — Serwist + Dexie 4.x (DEC-019) + manifest + icônes maskable + splash iOS DPR + ConnectionStatus 4 cas + sync engine + persistence storage warning > 7j (DEC-022) + transitions fade-in template.tsx (DEC-020) + iOS PWA quirks documentés CONCERNS.md. **Estimation : 8-10 h.** Livré 2026-05-18, 8 PR (#109-#116), ~1h40 wall-clock réel (-82% vélocité).
- [x] **Phase 05: E2E Passe 3 — Récurrences + cockpit + SMS + patient absent** — `packages/recurrence` 100% (dialyse 3×/sem, exceptions jours fériés 974) + cockpit régulateur Realtime Supabase + SMS rappel J-1 et J-2h via Twilio + workflow patient absent au pickup + logique no-show vs annulation patient. **Estimation : 10-15 h. Livré 2026-05-19, 13 PR (#121-#133) + 2 auto-commits types** (pipeline GSD 5/5 complet, 11 migrations BDD, `@tap/recurrence` 100% branches + `@tap/sms` ≥80%, 4 Route Handlers, cockpit Realtime + modal récurrence cascade DEC-048 + UI admin SMS + workflow no-show PWA→cockpit, pipeline GitHub Actions 100% auto-trigger types validé 2 fois). Tableau de bord pilotage dirigeant reporté Phase 06.
- [x] **Phase 05.5: Tarif CGSS réel** — Implémentation calcul réel `computeCgssShortTrip` (remplace stub Phase 04.7), grille tarif CGSS 2026 (forfait/km/majo nuit/dim/férié/supp TPMR), page grille active + historique + simulation, recalcul rétroactif courses historiques. 100% branch coverage Vitest (DEC-021). **Estimation : 8-12 h. Livré 2026-05-19, 6 PR (#136-#142)** (pipeline GSD 5/5 complet, migration `tariff_grids` versionnée + `computeCgssShortTrip`/`computeCgssFromDistance` fonction pure 15 cas 100% branches, page `/admin/tarifs` grille active + simulateur live + historique + édition INSERT-only, `PricingBreakdown` enrichi sans badge DEMO + disclaimer estimatif, recalcul rétroactif garde-fous DEC-060, DEC-056..061 LOCKED).
- [x] **Phase 06: E2E Passe 4 (resserrée) — Facturation CGSS PDF + audit RLS/Server Actions + dettes CI** — Périmètre resserré par le discuss (DEC-063) : facturation CGSS PDF récapitulatif mensuel (`/admin/facturation`) + audit RLS systémique (28 tables) + advisors sécurité + audit des 38 Server Actions (DEC-040/041) + résolution des dettes CI V1.5 (ESLint flat config, SIRET Luhn, runner pgTAP). HDS, OR-Tools, portail B2B et télétransmission B2/CNDA sortis du périmètre (sous-phases 06.5 / 06.7 et reports ADR-005/006). **Livré 2026-05-21, 4 waves (#148/#149 dettes CI, #150 facturation, #151/#152 audit RLS, audit SA + clôture).**
- [x] **Phase 06.6: Conformité assistée (Espace dirigeant)** — Pré-remplissage des pages RGPD pour que le dirigeant n'ait plus à les rédiger de zéro. Bouton « pré-remplir » DÉCLENCHÉ (jamais auto), entrées éditables/supprimables, disclaimers (point de départ à valider, pas conseil juridique). Pré-remplissage RÉEL = registre des traitements (traitements-types transport sanitaire) ± DPA (fiches sous-traitants techniques) ± DPIA (trame ou différé) ; breaches/requests/dpo = aide contextuelle seule (vides par nature). **Depends on: Phase 06 (autonome — fonctionnel pur livrable en bêta, n'attend PAS HDS ; les entrées du registre sont quelques lignes re-migrables sans douleur si HDS arrive ensuite). Décision 2026-05-21 : faite AVANT HDS. Retour terrain dirigeant.**
- [x] **Phase 06.7: OR-Tools optimisation de tournées** — Microservice Python OR-Tools (`apps/web/api/solver/` après bascule hybride PR #195) + `packages/optimizer-client` (DEC-066) + écran `/cockpit/optimisation` (mutualisation + ordonnancement, véhicule suggéré, journée entière). Affectation chauffeur et ré-optimisation dynamique hors V1 → Phase 06.7-bis (DEC-079). Distance V1 = Haversine × facteur (DEC-056). **Livré 2026-06-01, 4 waves (Wave 1 PR #185+#186, Wave 2 PR #188, Wave 3 PR #192, Wave 4 PR #204). Clôture fonctionnelle 2026-06-01 avec mock optimizer (PR #200, `OPTIMIZER_USE_MOCK=true`) + walkthrough utilisateur OK. Hébergement Python réel reporté — 3 dettes assumées (cf. `docs/dette-technique/2026-06-01-phase-06.7-cloture.md`). Depends on: Phase 06.**
- [x] **Phase 06.8: Tableau de bord dirigeant (Espace dirigeant)** — Page d'accueil de pilotage : CA mensuel, courses à facturer, alertes, activité chauffeurs. Comble l'absence de vue d'ensemble dirigeant (pages-outils éparses aujourd'hui). Piste « indicateurs de statut de conformité par section » à intégrer (cf. Phase 06.6). **Depends on: Phase 06 (autonome — fonctionnel pur, n'attend pas HDS). Retour terrain dirigeant 2026-05-21.**
- [ ] **Phase 06.10: Dettes techniques Phase 06.7** — Traitement des dettes D1 (hébergement Python solveur) et D2 (pipeline geocoding au moment création course) identifiées à la clôture Phase 06.7. Wave 1 : tentative Vercel Python `/py/` hors `/api/` (pattern non encore essayé après 5 PR de fix infructueuses), bascule Render Starter (~7 $/mois) si échec — cf. ADR-009. Wave 2 : audit `AddressPickerField` + fix `createRide` pour persister lat/lng/citycode (rate-limit 50 req/s sur Géoplateforme IGN). D3 (passe UX complète) et D4 (audit casts) différées explicitement. **Depends on: Phase 06.7 (close).** Estimation : 6-15 h selon résultats Wave 1.
- [ ] **Phase 06.9: Modernisation Next.js 15** — Montée Next.js 14.2 → 15 : audit de la rupture du cache `fetch()` (Next 15 ne met plus les requêtes en cache par défaut — chaque appel doit être audité pour rétablir explicitement le cache là où il était attendu), Turbopack dev stable, React 18 conservé (React 19 différé). Phase de modernisation autonome, faisable en bêta — ne dépend plus de HDS. **Depends on: aucune (modernisation). Estimation : à cadrer en discuss. Cf. DEC-076, ADR-007.**
- [ ] **Phase 07: Mobile native chauffeur (OPTIONNEL — décision business V2)** — App native iOS + Android (React Native ou Capacitor) + géoloc continue + mode hors-ligne complet + reconnaissance vocale + push natives + mode lecture seule chauffeur. Phase 04.9 PWA peut suffire si business case mobile natif non validé (coût 10× inférieur, même périmètre fonctionnel). **Estimation : 25-40 h.**
- [ ] **Phase 09: Migration HDS** (ex-Phase 06.5) — Migration de l'hébergement vers une infra HDS-certifiée (DEC-065). Sous-phase dédiée : discuss propre + ADR pour le choix fournisseur (Scaleway HDS / OVHcloud HDS / validation Supabase EU + DPA). Prérequis : audit RLS Phase 06. **Depends on: pré-production commerciale — repoussé en bêta (décision état bêta, DEC-077). Verrou avant 1er client payant.**
- [ ] **Phase 10: Géolocalisation opérationnelle temps réel** (ex-Phase 08) — Suivi position véhicules pour la régulation : carte cockpit live, ETA temps réel (régulateur + patient SMS), km à vide / km en charge réels, comparaison itinéraire prévu vs réalisé, historique 90 j puis purge (CDC §5.17). **Distincte de la géoloc certifiée facturation (hors périmètre, DEC-074).** Depends on: Phase 09 (HDS — DEC-075, position de véhicules-patients = donnée de santé indirecte). Faisabilité technique liée à Phase 07 : la capture GPS en arrière-plan n'est pas fiable en PWA (iOS surtout) — le discuss devra trancher PWA premier-plan dégradé vs natif. **Estimation : à cadrer en discuss.**

## Phase Details

### Phase 0: Fondations Lot 0
**Goal**: Disposer d'un monorepo Turborepo + Supabase multi-tenant prêt à recevoir la valeur métier, avec CI/CD verte et tests RLS automatisés.
**Depends on**: Nothing (first phase)
**Requirements**: FOND-01, FOND-02, FOND-03, FOND-04, FOND-05, FOND-06, FOND-07, FOND-08
**Success Criteria** (what must be TRUE):
  1. `pnpm install && pnpm dev` démarre le monorepo sans erreur
  2. Les migrations Supabase 001 et 002 s'appliquent et les tests pgTAP passent en CI
  3. Un utilisateur d'une `organization_id A` ne peut JAMAIS lire les données d'une `organization_id B`
  4. Les comptes de démo (dirigeant, régulateur, chauffeur) sont seedés et fonctionnels
  5. Les ADRs ADR-001 (monorepo) et ADR-002 (RLS) sont versionnés et acceptés
**Plans**: livré (commit `f68b1d2`)
**Status**: Complete (2026-05-06)

### Phase 1: Référentiel patients
**Goal**: La régulatrice peut créer, consulter, rechercher et annoter une fiche patient avec un NIR chiffré et des préférences exploitables par les autres modules.
**Depends on**: Phase 0
**Requirements**: PAT-01, PAT-02, PAT-03, PAT-04, PAT-05, PAT-06, PAT-07
**Success Criteria** (what must be TRUE):
  1. La régulatrice peut créer une fiche patient en remplissant un formulaire validé par zod
  2. Le NIR est stocké chiffré AES-256-GCM, jamais visible en base claire ni dans les logs
  3. Une recherche à 2 caractères (nom, prénom, ou téléphone) retourne instantanément les patients correspondants en fuzzy
  4. La régulatrice peut renseigner les préférences patient (SMS / appel / aucun) et une note opérationnelle libre
  5. Toute création ou modification de fiche patient apparaît dans `audit_logs` avec utilisateur, horodatage et delta
**Plans**: 5 plans (livrés en 16 commits, 4 vagues — 5/5 SC + 7/7 PAT-* delivered)
**Status**: Code complete (2026-05-06) — runtime CI verification human_needed
Plans:
- [ ] plans/PLAN-1.md — Wave 0 : tests scaffolds (pgTAP, Deno, Playwright, Vitest) en RED
- [ ] plans/PLAN-2.md — Wave 1 : migration 003 patients + validators étendus + types regen + schema push
- [ ] plans/PLAN-3.md — Wave 1 : Edge Function NIR (encrypt/decrypt/hash) + tests Deno GREEN
- [ ] plans/PLAN-4.md — Wave 2 : bootstrap apps/web (Next.js 14, Tailwind, shadcn/ui, middleware Supabase Auth, /login)
- [ ] plans/PLAN-5.md — Wave 3 : UI patient (liste + drawer 400px + détail + edit) + E2E GREEN
**UI hint**: yes

### Phase 1.5: DPA + RGPD compliance
**Goal**: Le SaaS dispose d'un cadre RGPD complet (registre des traitements, DPA Supabase signé, DPIA santé, portail droits patient) avant toute mise en service avec un design partner réel. Sans cette phase, l'usage par un patient réel = non-conforme RGPD niveau santé.
**Depends on**: Phase 1 (les patients existent — sinon pas de droits à exercer)
**Requirements**: DPA-01, DPA-02, DPA-03, DPA-04, DPA-05, DPA-06, DPA-07, DPA-08
**Success Criteria** (what must be TRUE):
  1. Le registre des traitements (art. 30 RGPD) est accessible en UI admin et exportable PDF
  2. Le DPA Supabase est signé et tracké en base avec date d'effet et version
  3. La DPIA (analyse d'impact santé) est documentée et révisable
  4. Un patient peut exercer ses droits (accès, rectification, effacement, portabilité) via un portail dédié
  5. Le DPO contact est publié + procédure de violation 72h documentée
**Plans**: 7 plans (5 vagues, parallélisme Wave 1 et Wave 3)
Plans:
- [ ] 1.5-01-PLAN.md — Wave 0 : scaffold tests RGPD (16 fichiers) + 4 deps justifiées (@react-pdf/renderer, jose, next-mdx-remote, gray-matter)
- [ ] 1.5-02-PLAN.md — Wave 1 : migration RGPD (5 tables + 3 additionnelles + RLS + audit triggers + watchdog 72h pg_cron + RPC anonymize)
- [ ] 1.5-03-PLAN.md — Wave 1 : helpers purs (legal-token JWT jose, patient-data-export, patient-anonymize, validators legal zod)
- [ ] 1.5-04-PLAN.md — Wave 2 : middleware /legal/* public + layouts (public)/(admin) + bandeau cookies CNIL-conforme
- [ ] 1.5-05-PLAN.md — Wave 3 : pages SSG /legal/* + portail patient (verify token, identity, access, erasure)
- [ ] 1.5-06-PLAN.md — Wave 3 : UI admin /admin/legal/* (registre/dpa/dpia/breaches/requests/dpo) + export PDF + compteur 72h temps réel
- [ ] 1.5-07-PLAN.md — Wave 4 : schema push BLOCKING + verification gate (pgTAP + Vitest + Playwright + no-leak audit)
**Tag**: Infra/légal — bloque la mise en service avec un design partner réel
**UI hint**: yes (UI admin légère + portail patient)

### Phase 0.7: Déploiement continu Vercel + démo seedée
**Goal**: Toute phase ≥ 2 produit une preview Vercel cliquable + un walkthrough scripté + des screenshots dans `docs/showcase/`. Sans cette infrastructure, le « Visible Progress Mandate » (CLAUDE.md § 13.5) ne peut pas être respecté. Phase d'infra purement transverse — débloque la dimension *montrable* de toutes les phases suivantes.
**Depends on**: Phase 1.5 (sécurité RGPD avant qu'une URL publique expose des données patient — même seed)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. Chaque push sur main déclenche un déploiement Vercel production avec URL stable
  2. Un environnement Supabase est connecté à Vercel via env vars (8 vars posées par setup-vercel.yml workflow)
  3. Un seed démo 974 (`supabase/seed.sql` + `seed.demo.sql`) crée 1 organization, 4 comptes auth (dirigeant + régulateur + chauffeur + reg-demo E2E), 10 patients fictifs réunionnais (Hoarau/Payet/Grondin/Boyer/Dijoux/Maillot/Lebon/Robert/Vergoz/Bègue), notes opérationnelles + contraintes typées
  4. Les 3 comptes démo (`dirigeant@demo.tap`, `regulateur@demo.tap`, `chauffeur@demo.tap`, mot de passe `demo1234!`) sont seedés et affichés en bas de `/login` UNIQUEMENT en mode preview/staging (jamais production commerciale)
  5. Un dossier `docs/showcase/` est créé avec un README expliquant la convention `{phase-num}-{slug}/` pour ranger screenshots et GIFs
  6. Smoke test Playwright `tests/smoke/preview.spec.ts` (7 scénarios) lancé automatiquement sur chaque deployment_status Vercel via `preview-smoke.yml`
**Plans**: livré 2026-05-07 (8 commits) — voir `.planning/phases/00.7-deploiement-vercel/0.7-SUMMARY.md`
**Status**: Code complete (2026-05-07) — première validation cloud en attente du run user `setup-vercel.yml`
**Implémentation réelle**:
- 3 GitHub Actions workflows : `setup-vercel.yml` (manuel 1×, env vars + Edge secrets + redeploy), `cd.yml` étendu (auto push main, migrations + seed + Edge Functions deploy + Vercel deploy), `preview-smoke.yml` (auto deployment_status, Playwright smoke)
- Page `/welcome` statique (apps/web/src/app/welcome/page.tsx) avec checklist 6 secrets GitHub + 1 clic Run workflow
- Middleware tolérant env vars absentes → redirect /welcome au lieu de 500
- vercel.json `ignoreCommand` strict main-only (zéro build sur branches dev)
**Tag**: Infra (transverse, débloque tout)
**UI hint**: yes (page /welcome + comptes démo sur /login)

### Phase 2: Saisie express course
**Goal**: La régulatrice peut saisir une course en mode express en moins de 30 secondes, avec brouillons en file d'attente et multi-saisies parallèles, sans jamais être bloquée par un appel entrant.
**Depends on**: Phase 1
**Requirements**: SAIS-01, SAIS-02, SAIS-03, SAIS-04, SAIS-05, SAIS-06
**Success Criteria** (what must be TRUE):
  1. Un test E2E Playwright mesure la saisie complète d'une course type en moins de 30 secondes
  2. Le raccourci `Cmd/Ctrl+Shift+K` ouvre la saisie express depuis n'importe quel écran régulateur
  3. La régulatrice peut mettre une saisie en pause, ouvrir une autre saisie, puis reprendre la première sans perte de données
  4. La recherche patient dans le formulaire retourne des résultats à 2 caractères en fuzzy
  5. Toute course créée écrit une ligne d'audit dans `audit_logs`
**Plans**: 6 plans (6 vagues, parallélisme limité — Wave 0 → Wave 5)
Plans:
- [ ] 02-01-PLAN.md — Wave 0 : refonte zod ride.ts + chrono-node + shadcn dialog/dropdown + scaffolds tests RED + showcase placeholder
- [ ] 02-02-PLAN.md — Wave 1 : migration 004 rides+ride_draft + RLS forcée + audit trigger + 29 assertions pgTAP GREEN + types regen
- [ ] 02-03-PLAN.md — Wave 2 : Server Actions (createRide + upsertDraft + deleteDraft + listDraftsAction) + queries RSC (listRides, listDrafts, listRecentPickupAddresses)
- [ ] 02-04-PLAN.md — Wave 3 : useGlobalShortcut Cmd+Shift+K + orchestrator multi-instance + RideExpressModal Dialog Radix + auto-save + optimistic submit
- [ ] 02-05-PLAN.md — Wave 4 : layout intégration + bouton header + DraftQueue + page /courses RSC + RidesList client
- [ ] 02-06-PLAN.md — Wave 5 : E2E saisie-express SAIS-01..06 GREEN + smoke preview étendu + 6 captures Visible Progress + 02-SUMMARY.md
**UI hint**: yes

### Phase 03: E2E Passe 1 — Squelette + clôture-bis
**Goal fonctionnel**: Un design partner enchaîne 5 courses sans assistance — saisir une course, l'assigner à un chauffeur+véhicule, démarrer côté chauffeur (mobile-web), clôturer avec tarif manuel + encaissement on/off, voir la trace dans la liste du jour. Édition course + annulation + CRUD admin chauffeurs/véhicules livrés en clôture-bis avant la PWA.
**Goal UX**: Shell régulateur refondu (header sticky 56px, mode jour/nuit, UserMenu, raccourcis clavier visibles), liste patients enrichie, drawer course 480px, modal assignation propre, vue chauffeur mobile 375px avec sections « Aujourd'hui » + « Demain ».
**Depends on**: Phase 2 (saisie express)
**Requirements**: NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-006 (méthode E2E)
**Success Criteria** (what must be TRUE):
  1. Un design partner peut enchaîner 5 courses sans demander d'aide (test manuel walkthrough scripté)
  2. Le shell régulateur (mode jour ET mode nuit) ressemble à Linear/Stripe — capture publiable
  3. Une course peut être créée, modifiée, assignée, exécutée, clôturée, annulée — tous statuts gérés
  4. Le chauffeur voit ses courses J + J+1 sur PWA mobile 375px, avec sections groupées
  5. Role guards layouts : chauffeur → /conduite, régulateur → /patients (defense in depth RLS)
  6. CRUD admin chauffeurs/véhicules opérationnel (`/admin/chauffeurs`, `/admin/vehicules`)
  7. Profils démo anonymisés (Dirigeant Démo / Régulateur Démo / Chauffeur Démo)
**Plans**: livré 2026-05-12 sans planification GSD formelle (pré-migration GSD).
Sous-blocs livrés : 03-A (migrations + seed) → 03-B (Server Actions + queries) → 03-C (shell refonte) → 03-D (écrans dirigeant/régulateur) → 03-E (écran chauffeur) → 03-cloture (12 frictions + édition course) → 03-cloture-bis (annulation + CRUD admin).
Branches : `claude/consolidate-phase-3-validation-9Tzax` + `feat/03-cloture-bis-annulation-crud-admin`.
**Status**: Code complete (2026-05-12) — validation manuelle dirigeant en attente, rituel 5/5 captures à jouer post-merge.
**UI hint**: yes (shell refondu + 10 captures showcase placeholders dans `docs/showcase/03-e2e-passe1-squelette/`)

### Phase 03.1: Efficience saisie modal course (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 03
**Plans:** 3/5 plans executed

Plans:
- [ ] TBD (run /gsd-plan-phase 03.1 to break down)

> **Phase 03.1.1 supprimée (DEC-023)** : stub jamais utilisé, travail absorbé par la série PR #47..#55 Phase 03.2 (DateTimeFields finalisé + AddressPickerField BAN).

### Phase 04: Onboarding chauffeur + AuthShell — LIVRÉE 2026-05-13
**Goal fonctionnel**: Le dirigeant ET le régulateur invitent un chauffeur par email. Le chauffeur active son compte via un magic link Supabase Auth, est rattaché à sa fiche `drivers` existante, puis peut se connecter via `/login` refondu.
**Goal UX**: `<AuthShell>` réutilisable — layout split desktop, single column mobile. `/login` + `/welcome` + `/setup` refondus en mode jour, captures publiables. `DemoCredentials` cards cliquables qui prefill le form si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`. Premier RHF + `zodResolver` du repo (DEC-018).
**Depends on**: Phase 03.2 (squelette E2E + CRUD admin chauffeurs + hotfixes finition)
**Plans**: 5 plans GSD pipeline complet (livrés sur PR #59).
**Status**: Complete (2026-05-13) — 135 min execution vs 330 estimés (-59%).
**Hotfixes post-merge** (PR #60..#67, 5 hotfixes mergés 2026-05-13/14) :
- PR #60 DEC-029 : sémantique 4 actions chauffeurs (Désactiver / Réactiver / Archiver / Désarchiver) avec 3 lignes de défense (Server Action + RLS + trigger column-level)
- PR #61 DEC-030 : audit FR rédac user-facing (cadratins articulation/définition → `:`, anglicismes `assigner→affecter`)
- PR #62 DEC-031 : seed démo étendu UAT multi-chauffeurs (3 chauffeurs auth + 12 courses fictives)
- PR #63 : /admin/chauffeurs vide régulateur (cause root schéma — colonne `archive_motif` manquante preview)
- PR #64+#66 DEC-032 : CD réconcilié + playbook schema_migrations drift
- PR #65 DEC-033 : clé React listes composants client inclut champ mutable (4 listes)
- PR #67 : push final cleanup commit
**Captures Visible Progress**: 2 livrées (`/login` jour, `/accept-invite`)
**UI hint**: yes

### Phase 04.5: Robustesse régulateur + dette CONCERNS
**Goal fonctionnel**: Frictions et risques opérationnels documentés `CONCERNS.md` levés. La régulatrice ne peut plus mismatcher permis/véhicule. La timeline audit affiche le nom de l'acteur. Modals dépassant 300L découpées proprement. Audit permissions étendu aux autres modules admin selon leçon DEC-029. Workflow patient absent (cas métier ressorti UAT).
**Goal UX**: Aucun nouvel écran majeur. Amélioration ciblée modal assignation + workflow patient absent. Livraison en retard des 10 captures showcase Phase 03 (Visible Progress § 13.5).
**Depends on**: Phase 04 + UAT walkthrough dirigeant terminé (frictions UAT en input pour ajuster périmètre)
**Requirements**: NFR-006 + dette CONCERNS.md + frictions UAT
**Périmètre cadré CONCERNS.md (à valider contre UAT)** :
1. Filtrage `type_permis` ↔ `vehicle.type` modal assignation (CONCERNS.md severity major)
2. Audit logs enrichissement nom acteur (join `profiles.first_name + last_name` OU dénormalisation)
3. Découpe `ride-express-modal.client.tsx` (384L → <300L orchestrateur fin)
4. Découpe `ride-drawer.client.tsx` (337L → <300L)
5. Régénération types Supabase (`pnpm db:types`) + suppression des 5 `TODO(types)`
6. Production des 10 captures showcase Phase 03 pending (`docs/showcase/03-e2e-passe1-squelette/`)
7. Audit permissions autres modules admin (vehicules, legal/*) selon leçon DEC-029
8. Workflow patient absent (cas métier ressorti UAT)

**Note** : périmètre 8 items potentiellement à réorienter selon frictions UAT remontées par dirigeant.

**Périmètre — hors**: Aucun écran fonctionnel majeur nouveau (les hotfixes UAT Phase 04 ont déjà absorbé ce qui était urgent).
**Plans**: TBD — voir `/gsd-discuss-phase 04.5` puis `/gsd-plan-phase 04.5`
**Captures Visible Progress**: 0 nouvelles (livraison 10 captures Phase 03 en retard)
**Estimation**: 6-9 h
**UI hint**: no (dette technique + showcase + workflow ponctuel)
**Canonical refs**: `.planning/phases/04.5-robustesse-regulateur/04.5-CONTEXT.md` (à créer en discuss)

### Phase 04.7: Pricing mockup + Caisse + Migration géocoding (INSERTED DEC-023)
**Goal fonctionnel**: La chaîne pricing UI est en place sans calcul réel. `packages/pricing` exporte un **stub** `computeCgssShortTrip` retournant des valeurs hardcodées clairement « DEMO ». `PricingBreakdown` UI réel à la clôture. `OverrideTarifModal` fonctionnel et tracé `audit_logs`. Page `/courses/caisse` avec totaux et export CSV. Migration BDD préparée pour `lat/lng/citycode` mais **non consommée** par le pricing.
**Goal UX**: `PricingBreakdown` lisible avec mention visible « DEMO — tarif non contractuel » (UI lock anti-facturation). `OverrideTarifModal` avec raison obligatoire. `/courses/caisse` table dense type Stripe Balance, groupes expandables par chauffeur, sous-totaux + total `<tfoot>`.
**Depends on**: Phase 04.5 (modals découpées propres + types regen)
**Requirements**: PRIC-01..03 partial (stub only), CAIS-01..03, NFR-001..006
**Périmètre — dans**:
- `packages/pricing` workspace clone de `packages/shared`, fonction pure stub `computeCgssShortTrip` retournant `{ amount_eur, breakdown, source: 'cgss_auto_demo' }` avec valeurs hardcodées DEMO
- **100 % Vitest sur le contrat de la fonction** (DEC-013) — la couverture porte sur le contrat pur, pas la grille réelle (qui arrive 05.5)
- Migration BDD : `rides.pickup_lat numeric(10,7) NULL`, `pickup_lng numeric(10,7) NULL`, `pickup_citycode text NULL` + `dropoff_*` idem
- Threading lat/lng depuis `AddressPickerField` BAN (Phase 03.2.7) vers `createRideAction` / `editRideAction` (lift D-ADDR-06)
- `<PricingBreakdown>` composant avec **badge « DEMO »** visible (Lucide `AlertTriangle` + `text-warning`)
- `<OverrideTarifModal>` régulateur depuis `ride-drawer` + override inline dans `end-ride-modal` chauffeur
- `/courses/caisse?date=YYYY-MM-DD` Server Component + `_lib/queries-caisse.ts` (miroir `queries-enriched.ts`)
- Export CSV via Server Action retournant `Response` `text/csv; charset=utf-8` avec UTF-8 BOM (`U+FEFF`) + séparateur `;` + format date FR (`jj/mm/aaaa`) pour Excel FR
- Permissions régulateur + dirigeant uniquement sur `/courses/caisse` (RLS Server Component)
**Périmètre — hors** (reporté Phase 05.5 — DEC-021):
- Calcul tarif **réel** CGSS court trajet 974
- Décision distance (OSRM auto-hébergé / Mapbox / OpenRoute paid / Haversine + override Hauts)
- Validation grille tarifaire dirigeant avec cas de référence
- Backfill géocoding courses pré-Phase-04.7 (Phase 06 si volume)
**Success Criteria** (what must be TRUE):
  1. Régulateur ouvre une course clôturée, voit `PricingBreakdown` avec mention « DEMO » + valeurs hardcodées cohérentes (forfait + km factice + total)
  2. `OverrideTarifModal` accessible depuis `ride-drawer`, raison obligatoire (RHF + zod), trace `audit_logs` avec ancien montant + nouveau + raison
  3. `/courses/caisse` affiche récap journée par chauffeur (groupes expandables), totaux pied `<tfoot>`
  4. Export CSV s'ouvre dans Excel FR sans encoding cassé (UTF-8 BOM + `;` séparateur)
  5. Migration géocoding appliquée, `lat/lng/citycode` threadés depuis BAN dans `rides`
**Plans**: TBD — voir `/gsd-discuss-phase 04.7` puis `/gsd-plan-phase 04.7`
**Captures Visible Progress**: 3 (`PricingBreakdown` DEMO, `OverrideTarifModal`, `/courses/caisse`)
**Estimation**: 6-9 h
**UI hint**: yes (PricingBreakdown + Override + CaisseTable)
**Canonical refs**: `.planning/phases/04.7-pricing-mockup-caisse/04.7-CONTEXT.md`, `04-UI-SPEC.md` (§ 7.3 PricingBreakdown + § 7.4 OverrideTarifModal + § 7.5 CaisseTable)

### Phase 04.9: PWA chauffeur enveloppe (INSERTED DEC-023)
**Goal fonctionnel**: Le chauffeur installe la PWA sur son téléphone, travaille hors-ligne 1 h, mutations syncées au retour réseau.
**Goal UX**: Manifest et icônes maskable propres, splash iOS par DPR, `ConnectionStatus` header 4 cas (`online idle` / `synching` / `offline + queue` / `offline idle`), transitions fade-in via `template.tsx` (DEC-020 — slide bidirectionnel iOS-style reporté Phase UI dédiée).
**Depends on**: Phase 04.7 (caisse + pricing stub livrés — la PWA emballe un code mûr)
**Requirements**: CHAUF-01..04 (PWA + offline), DEC-014, NFR-001..006
**Périmètre — dans**:
- Manifest static `apps/web/public/manifest.json` + 4 icônes (192/512 `any` + `maskable`)
- Splash iOS `apple-touch-startup-image` 3 DPR minimum (iPhone SE 750×1334, iPhone 13/14 1170×2532, iPhone 15 Pro Max 1290×2796)
- Serwist scaffold (`withSerwistInit` dans `next.config.ts`, scope `/conduite*`, `reloadOnOnline: false`, `disable: NODE_ENV === 'development'`)
- Dexie 4.x schema : table `mutations_queue` + miroir local des courses du jour
- Sync engine : queue, retry exponentiel base 2s + jitter ±500ms, max 30s, **3 essais max**, dead letter queue avec toast Sonner destructive
- **Spike Wave 1** : Server Action via `fetch(actionURL, { headers: 'Next-Action' })` vs Route Handler `/api/driver/rides/[id]/start|end` — trancher empiriquement (le dirigeant a indiqué préférer Route Handlers explicites Alt A, à formaliser dans le plan)
- `<ConnectionStatus>` header 4 cas avec `useLiveQuery` Dexie sur `pendingCount`
- `navigator.storage.persist()` au mount PWA + tracking `lastUsedAt` + warning UI banner si > 7 j inactivité (DEC-022 — iOS purge IndexedDB ~2 sem inactivité PWA)
- Listener `window.addEventListener('online', flushQueue)` pour replay (Background Sync API non supporté iOS 17+/18)
- Transitions fade-in via `template.tsx` (DEC-020 — slide reporté Phase UI dédiée, bug `vercel/next.js#42658` template.tsx n'anime pas la sortie)
**Périmètre — hors** (reporté):
- Cache PWA régulateur `/courses` (Phase 05)
- Hors-ligne > 1 h (Phase 06)
- Push notifications Web Push API VAPID (Phase 06)
- Géolocalisation temps réel (Phase 06)
- Slide bidirectionnel iOS-style PWA Driver (Phase UI dédiée)
**Success Criteria** (what must be TRUE):
  1. PWA installable propre iPhone + Android (icônes nettes, splash identité, `theme_color` cohérent)
  2. Démarrer + clôturer course en mode avion, mutation sync au retour réseau, `audit_logs` cohérent
  3. `ConnectionStatus` affiche les 4 états distinctement (test Playwright assertions)
  4. Warning UI > 7 j inactivité visible au prochain mount PWA
  5. Dead letter queue toast Sonner après 3 échecs de retry
**Plans**: TBD — voir `/gsd-discuss-phase 04.9` puis `/gsd-plan-phase 04.9`
**Captures Visible Progress**: 2 (PWA installée iPhone capture device réel, course offline + sync GIF)
**Estimation**: 8-10 h
**UI hint**: yes (PWA install assets + ConnectionStatus + Driver Shell)
**Canonical refs**: `.planning/phases/04.9-pwa-chauffeur-enveloppe/04.9-CONTEXT.md`, `04-UI-SPEC.md` (§ 7.1 ConnectionStatus + § 7.2 PWA Driver Shell + § 8 PWA install assets)

### Phase 05: E2E Passe 3 — Récurrences + cockpit temps réel + SMS + patient absent
**Goal fonctionnel**: La régulatrice configure une récurrence dialyse (3×/semaine, lundi/mercredi/vendredi 08h00) et toutes les occurrences se génèrent automatiquement, en respectant les jours fériés 974 (1er mai, 20 décembre, etc.). Elle voit son cockpit temps réel (Realtime Supabase) avec courses en cours, retards, alertes. Les patients reçoivent un SMS de rappel J-1 à 18h et J-2h via Twilio. **Workflow patient absent au pickup** : le chauffeur déclare l'absence via la PWA, la régulatrice reçoit une alerte cockpit, décide reprogrammation ou annulation, action tracée `audit_logs`.
**Goal UX**: Cockpit en table dense Linear-style avec cellules colorées par statut, mise à jour fluide sans flash (Realtime + animations subtiles). Modal récurrence avec preview des 4 prochaines occurrences. Templates SMS éditables avec preview FR/créole. Modal alerte cockpit patient absent avec actions « Reprogrammer » / « Annuler course ».
**Depends on**: Phase 04.9 (PWA chauffeur déployée — le chauffeur déclare l'absence depuis la PWA)
**Requirements**: RECU-01..06, COCK-01..05, SMS-01..05, NFR-001..006
**Périmètre — dans**:
- `packages/recurrence` : moteur génération occurrences (rrule-like), 100% branches (DEC-013)
- Exceptions jours fériés 974 (table de référence + override manuel)
- Décrément bon de transport `prescription` à chaque occurrence générée
- Cockpit régulatrice `/cockpit` : Realtime Supabase, courses en cours, alertes retard
- `packages/sms` : Twilio adapter, templates personnalisables, consentement strictement vérifié (DEC-008)
- SMS rappel J-1 18h00 (cron) + J-2h (cron) avec template patient
- Tracking delivery status (sent/delivered/failed) dans `sms_message`
- **Workflow patient absent au pickup** : chauffeur déclare via PWA, régulatrice reçoit alerte cockpit, modal décision (reprogrammation ou annulation), action tracée `audit_logs` + notification optionnelle famille
**Périmètre — hors** (reporté Passe 4) :
- Réception SMS patient (réponse → fiche patient)
- KPIs dirigeant
- Imprévus complexes (panne, multi-patient absent automatique)
**Success Criteria** (what must be TRUE):
  1. La régulatrice crée une récurrence dialyse 3×/semaine et voit les occurrences dans le planning
  2. Les jours fériés 974 ne génèrent pas d'occurrence sauf override explicite
  3. Couverture `packages/recurrence` à 100% branches en CI (échec si < 100%)
  4. Le cockpit affiche les courses en cours et reflète les changements de statut sans reload
  5. Le SMS rappel J-1 part automatiquement à 18h pour tous les patients consentants
  6. Tout SMS sortant respecte le consentement actif (DEC-008) et trace dans `sms_message`
  7. **Chauffeur déclare patient absent depuis PWA → alerte cockpit régulateur sous 5s, décision tracée `audit_logs`**
**Plans**: TBD — voir `/gsd-discuss-phase 05` puis `/gsd-plan-phase 05`
**UI hint**: yes (cockpit temps réel + modal récurrence + templates SMS + modal patient absent)

### Phase 05.5: Tarif CGSS réel (INSERTED DEC-021)
**Goal fonctionnel**: Remplacer le **stub** Phase 04.7 par un calcul tarif CGSS court trajet **réel**. Forfait base + distance routière + grille validée dirigeant. Override manuel toujours possible et tracé.
**Goal UX**: `PricingBreakdown` sans plus la mention « DEMO ». Indication de la source distance (route OSRM / vol d'oiseau Haversine).
**Depends on**: Phase 05 (récurrences livrées — calibration grille tarifaire sur volume réel)
**Requirements**: PRIC-01..04 (calcul réel), DEC-013 (couverture 100 %), NFR-001..006
**Périmètre — dans**:
- **Discuss dédiée préalable** `/gsd-discuss-phase 05.5` pour trancher la source distance :
  - OSRM auto-hébergé (Docker `services/osrm` + tuiles 974)
  - Mapbox (paid)
  - OpenRoute paid
  - Haversine pure JS + override manuel pour Hauts Réunion (Cilaos, Salazie)
- Validation grille tarifaire CGSS 974 dirigeant avec **5+ cas de référence**
- `packages/pricing` `computeCgssShortTrip` implémentation **réelle** (remplace stub Phase 04.7)
- 100 % branch coverage Vitest sur cas réels (DEC-013)
- Migration consommation `lat/lng/citycode` (préparés en 04.7)
- Service distance (selon décision discuss 05.5)
- Colonne `rides.distance_estimation_method` enum audit (`osrm` / `haversine`)
**Périmètre — hors** (reporté Phase 06):
- CGSS long trajet, suppléments TPMR, attente nocturne, dimanches / jours fériés 974
- Facturation mensuelle PDF CGSS
**Success Criteria** (what must be TRUE):
  1. `computeCgssShortTrip` ±0,01 € vs 5+ cas de référence dirigeant
  2. `PricingBreakdown` sans badge « DEMO », montant **facturable**
  3. Source distance indiquée (`osrm` ou `haversine`) selon disponibilité
  4. Test Vitest 100 % branch coverage GREEN en CI (échec si < 100%)
**Plans**: TBD — voir `/gsd-discuss-phase 05.5` puis `/gsd-plan-phase 05.5`
**Captures Visible Progress**: 1 (`PricingBreakdown` réel avec breakdown comparé DEMO)
**Estimation**: 8-12 h
**UI hint**: no (modification interne calcul, UI déjà livrée Phase 04.7 sans badge)
**Canonical refs**: `.planning/phases/05.5-pricing-cgss-reel/05.5-CONTEXT.md`

### Phase 06: E2E Passe 4 (resserrée) — Facturation CGSS PDF + audit sécurité + dettes CI — LIVRÉE 2026-05-21
**Goal fonctionnel**: Le dirigeant génère la facturation CGSS mensuelle en PDF récapitulatif. La sécurité base de données (RLS de toutes les tables, Server Actions, advisors) est auditée et durcie — prérequis de la migration HDS. La CI V1.5 est verdie.
**Goal UX**: Page `/admin/facturation` (sélection période, aperçu des courses facturables, téléchargement) ; PDF A4 récapitulatif (en-tête société, tableau, sous-totaux, total, disclaimer estimatif).
**Depends on**: Phase 05.5 (moteur de tarif CGSS consommé par la facturation)
**Périmètre — resserré par le discuss (DEC-063)** :
- Bloc A — facturation CGSS PDF mensuelle (`/admin/facturation` + Route Handler `@react-pdf/renderer`)
- Bloc E — audit RLS systémique (28 tables, `docs/security/RLS-AUDIT.md`) + advisors sécurité + audit des 38 Server Actions (`SERVER-ACTIONS-AUDIT.md`, DEC-040/041)
- Bloc F — dettes CI V1.5 : ESLint 9 flat config, SIRET Luhn, runner pgTAP
**Périmètre — sorti (sous-phases / reports)** :
- Migration HDS → Phase 06.5, renumérotée Phase 09 (DEC-065)
- OR-Tools optimisation de tournées → Phase 06.7 (DEC-066)
- Portail B2B multi-tenant → différé, ADR-006 (DEC-067)
- Télétransmission B2/SEFi/CNDA → différée, ADR-005 (DEC-064)
**Success Criteria** (what must be TRUE):
  1. Un PDF récapitulatif mensuel CGSS est généré et téléchargeable depuis `/admin/facturation` ✅
  2. La matrice RLS des 28 tables est documentée, les advisors search_path/SECURITY DEFINER traités ✅
  3. Les 38 Server Actions sont auditées ; guard `require*` (DEC-040) + row count (DEC-041) appliqués ✅
  4. Les dettes CI D1/D2/D3 sont résolues — CI lint + format verts ✅
**Plans**: 4 PLAN-N livrés (`PLAN-1` dettes CI, `PLAN-2` facturation, `PLAN-3` audit RLS, `PLAN-4` audit SA + clôture).
**Status**: Complete (2026-05-21).
**UI hint**: yes (`/admin/facturation` + PDF)

### Phase 06.6: Conformité assistée (Espace dirigeant)
**Goal**: Le dirigeant ne rédige plus ses pages RGPD de zéro — TAP propose un pré-remplissage des traitements-types d'un transport sanitaire, qu'il relit et ajuste.
**Depends on**: Phase 06 (autonome — fonctionnel pur, livrable en bêta sans attendre HDS. Décision dirigeant 2026-05-21 : faite AVANT 06.5. Les entrées du registre sont quelques lignes re-migrables sans douleur si la migration HDS suit.)
**Périmètre — à cadrer en discuss dédié** : bouton « pré-remplir » DÉCLENCHÉ par le dirigeant (jamais auto-remplissage — protège la responsabilité), entrées éditables/supprimables, disclaimers (« point de départ à vérifier et adapter, ne constitue pas un conseil juridique »). Nuance clé : pré-remplissage RÉEL = registre des traitements (courses patients, facturation CGSS, chauffeurs, données santé) ± DPA (fiches sous-traitants techniques Supabase/Vercel) ± DPIA (trame squelette ou différé) ; breaches/requests/dpo = aide contextuelle (textes guides), PAS de données fictives car vides par nature. Pattern industrie validé (templates RoPA pré-remplis, RGPD art. 30). Issu du retour terrain dirigeant 2026-05-21.
**UI hint**: yes (boutons + textes sur les pages `/admin/legal/*` existantes)
**Plans**: 3 PLAN-N livrés (PLAN-1 fondations registre, PLAN-2 écran de revue, PLAN-3 DPA/DPIA/aide/clôture).
**Status**: Complete (2026-05-21) — pipeline GSD 5/5, 3 waves (#162, #163, Wave 3). Écran de revue review-then-insert du registre + fiches DPA + trame DPIA + aide contextuelle breaches/requests. DEC-068..070 LOCKED. Aucune migration BDD. Voir `06.6-SUMMARY.md`.

### Phase 06.7: OR-Tools optimisation de tournées
**Goal**: Proposer à la régulatrice une optimisation des tournées (mutualisation + ordonnancement, véhicule suggéré, journée entière) via un microservice Python OR-Tools. Affectation automatique chauffeur et ré-optimisation dynamique temps réel hors V1 (DEC-079, D-01/D-03).
**Depends on**: Phase 06
**Status**: Complete (2026-06-01) — clôture fonctionnelle avec mock optimizer (`OPTIMIZER_USE_MOCK=true`). Hébergement Python réel reporté. 3 dettes tracées (cf. `docs/dette-technique/2026-06-01-phase-06.7-cloture.md`).
**Périmètre V1 livré** : `apps/web/api/solver/` (Python OR-Tools PDPTW, 11 pytest verts ; déplacé depuis `services/optimizer/` lors de la bascule hybride single-projet PR #195) + `packages/optimizer-client` (contrats zod, `solve()`, transformations, 24 Vitest verts) + écran `/cockpit/optimisation` (vue comparative, 2 indicateurs estimés, acceptation grain fin, écriture via Server Action, D-14/D-15/D-16/D-17/D-18/D-19). Distance V1 = Haversine × facteur de correction (DEC-056) ; OSRM avec la géoloc certifiée 2027. Hébergement Vercel Python serverless (DEC-079 LOCKED, ADR-008) — mock actif jusqu'à arbitrage ultérieur.
**Plans**: 3 plans (un par wave) — `/gsd-plan-phase 06.7` exécuté 2026-05-22.
- [x] 06.7-01-PLAN.md — Microservice Python `services/optimizer` (FastAPI + OR-Tools PDPTW, pytest, packaging Vercel)
- [x] 06.7-02-PLAN.md — Package TS `packages/optimizer-client` (contrat zod, client HTTP `solve()`, transformations, Vitest)
- [x] 06.7-03-PLAN.md — Écran cockpit `/cockpit/optimisation` + Route Handler dé-identifié + Server Action véhicule + E2E + clôture

### Phase 06.8: Tableau de bord dirigeant (Espace dirigeant)
**Goal**: Donner au dirigeant une vue d'ensemble de pilotage à l'ouverture de l'app, au lieu de pages-outils éparses.
**Depends on**: Phase 06 (autonome — fonctionnel pur, n'attend pas HDS)
**Périmètre — à cadrer en discuss dédié** : page d'accueil dirigeant avec KPIs (CA mensuel, courses à facturer ce mois, alertes, activité des chauffeurs). Données agrégées des modules existants (facturation 06, courses, chauffeurs). Piste « indicateurs de statut de conformité par section » (ex. « Registre : à jour ») à intégrer en lien avec la Phase 06.6. Issu du retour terrain dirigeant 2026-05-21 (initialement noté CONCERNS « tableau de bord pilotage »).
**UI hint**: yes (nouvelle page d'accueil dirigeant)
**Plans**: 2 PLAN-N livrés (PLAN-1 données + cartes, PLAN-2 page + redirection + clôture).
**Status**: Complete (2026-05-21) — pipeline GSD 5/5, 2 waves (#171, Wave 2). Page `/tableau-de-bord` (Server Component, pyramide inversée, 6 KPIs réutilisant les agrégations Caisse/Facturation + carte de conformité factuelle) + redirection par rôle (DEC-071) + onglet nav dirigeant. DEC-071..073 LOCKED. Aucune migration BDD. Voir `06.8-SUMMARY.md`.

### Phase 06.10: Dettes techniques Phase 06.7
**Goal**: Rendre l'optimiseur démontrable sur de vraies données en traitant les dettes D1 et D2.
**Depends on**: Phase 06.7 (close)
**Périmètre — à cadrer en discuss dédié** : Wave 1 tentative Vercel Python `/py/` hors `/api/` (1-4 h, critère d'abandon ferme à 4 h sans succès → bascule Render Starter Wave 1bis). Wave 2 audit pipeline geocoding et fix `createRide` (cas A=4 lignes, cas B=15-30 min, cas C=2-4 h selon état `AddressPickerField`). D3 (passe UX) et D4 (audit casts) restent tracées dans `docs/dette-technique/2026-06-01-phase-06.7-cloture.md` — différées explicitement.
**Plans**: 2 PLAN-N (PLAN-1 D1 hébergement Python, PLAN-2 D2 pipeline geocoding).
**Status**: Cadrage 2026-06-01. CONTEXT + DISCUSSION-LOG + 2 PLAN livrés. Pending exécution Wave 1.
**Canonical refs**: `.planning/phases/06.10-dettes-techniques-phase-06.7/`, `docs/adr/ADR-009-pattern-hebergement-services-couteux.md`, `docs/dette-technique/2026-06-01-enquete-open-source-dettes.md`.

### Phase 06.9: Modernisation Next.js 15
**Goal**: Monter le socle Next.js de 14.2 à 15, en bêta, sans attendre HDS — modernisation autonome qui assainit le terrain technique avant la mise en production.
**Depends on**: aucune (phase de modernisation). Menée après le patch de sécurité 14.2.35 (DEC-076, ADR-007).
**Périmètre — à cadrer en discuss dédié** : montée 14.2 → 15 ; audit de la rupture du cache `fetch()` (Next 15 ne met plus les requêtes `fetch()` en cache par défaut — chaque appel doit être audité pour rétablir explicitement le cache / `revalidate` là où le comportement implicite était attendu) ; Turbopack dev stable ; React 18 conservé. Audit ciblé, plus simple à mener en bêta qu'en production.
**Hors périmètre**: React 19 et Next 16 — différés (DEC-076, ADR-007).
**Estimation**: à cadrer en discuss
**UI hint**: no (modernisation technique — non-régression visuelle attendue)
**Plans**: TBD — `/gsd-discuss-phase 06.9`

---

## Dépendance des fonctionnalités héritées (pré-pivot)

Liste des modules CDC v2 qui n'ont pas (encore) de phase dédiée dans la
roadmap E2E v2. Ils sont implicitement traités dans une des passes 03-06,
ou explicitement reportés au-delà de V1.

| Module CDC v2 | Statut nouveau séquencement |
|---|---|
| Planning Gantt drag-and-drop | Reporté V2 (cockpit Passe 3 fournit la base, Gantt = enrichissement post-V1) |
| Géolocalisation temps réel chauffeur | Phase 10 (ex-Phase 08) — géoloc opérationnelle, post-HDS Phase 09 (DEC-075). Non requise en V1. |
| Routing GPS OSRM advanced (geocoding, alternatives, isochrones) | Reporté V2 (Passe 4 livre OSRM tuiles + RPC distance/eta basiques) |
| Mode dégradé complet | Partiellement Passe 4 (essentiel : enregistrement local pendant coupure ; complet V2) |
| KPIs dirigeant complets (drill-down M-1/M-12) | Reporté V2 (Passe 4 livre le PDF facturation, KPIs cockpit dirigeant V2) |
| Conformité réglementaire (alertes 90/60/30j carte pro/CT/visite med) | Reporté V2 |
| Exports comptables FEC + Lomaco | Reporté V2 |
| Beta terrain chauffeur Hauts Réunion | V1.5 — après livraison Passe 4 |

Justification du report : les passes E2E v2 priorisent un parcours
fonctionnel COMPLET pour la régulatrice + chauffeur sur les 6 maillons
métier (CDC v2 § 5). Les modules secondaires (Gantt, KPIs avancés,
conformité, exports) enrichissent cette base, ils ne la déverrouillent
pas. Trade-off : delivery V1 plus rapide vs périmètre V1 réduit. Adopté
par ADR-003.

### Phase 07: Mobile native chauffeur (OPTIONNEL — décision business V2)
**Goal fonctionnel**: App native iOS + Android pour les chauffeurs si la PWA Phase 04.9 ne couvre pas le périmètre offline / GPS continu attendu en production sur le terrain 974.
**Depends on**: Phase 06 livrée + décision business sur retour Phase 04.9 PWA
**Périmètre — à confirmer business case** :
1. App native iOS + Android (React Native ou Capacitor)
2. Géolocalisation continue avec consentement
3. Mode hors-ligne complet (Dexie + sync IndexedDB)
4. Reconnaissance vocale (annonce arrivée patient)
5. Notifications push natives
6. Mode lecture seule chauffeur (visualisation tournée)

**Note** : Phase 04.9 PWA peut suffire si business case mobile natif n'est pas validé. PWA = même périmètre fonctionnel avec coût 10× inférieur.

**Estimation**: 25-40 h
**UI hint**: yes (UI native différente de la PWA)
**Plans**: TBD — phase déclenchée seulement après décision business explicite post-Phase 06

---

### Phase 09: Migration HDS
**(ex-Phase 06.5 — renumérotée 2026-05-22, repoussée en fin de parcours, DEC-077.)**
**Goal**: Migrer l'hébergement vers une infra HDS-certifiée avant le premier client payant commercial (CON-001).
**Depends on**: pré-production commerciale. Repoussée en bêta (décision état bêta, DEC-077) : la migration HDS n'est plus un verrou proche — elle devient le pré-requis de la seule mise en production commerciale (verrou avant 1er client payant).
**Périmètre — à cadrer en discuss dédié** : choix du fournisseur (Scaleway HDS / OVHcloud HDS / validation Supabase EU + DPA, ADR), provisioning, migration des données, bascule DNS, suivi de RLS/Auth/pg_cron/Vault/Realtime. Inclut, à confirmer : NIR Edge Function 401, 2FA TOTP dirigeant, rotation des tokens Supabase, déplacement `pg_net` hors `public`, activation `leaked_password_protection`, pen test externe.
**Plans**: TBD — `/gsd-discuss-phase 09`.

---

### Phase 10: Géolocalisation opérationnelle temps réel
**(ex-Phase 08 — renumérotée 2026-05-22 ; suit la Phase 09 HDS.)**
**Goal**: La régulatrice voit la position temps réel des véhicules sur une carte cockpit, avec ETA, km à vide/charge réels et comparaison prévu/réalisé. Le patient reçoit un ETA par SMS.
**Depends on**: Phase 09 (HDS, DEC-075) : pas de positions réelles de véhicules-patients en prod avant HDS.
**Cadre RGPD géoloc salarié (CDC §5.17)**: base légale = exécution du contrat de travail ; information préalable obligatoire ; limitation au temps de service (pause déjeuner possible avec consentement) ; conservation 90 j puis purge automatique ; consultation réservée aux rôles dirigeant + régulateur.
**Contrainte technique structurante**: la capture GPS en arrière-plan PWA est non fiable (iOS Safari met l'app en pause hors premier plan ; Android Chrome s'interrompt si le chauffeur ouvre Waze/Maps ; le service worker n'a pas accès à `navigator.geolocation`). Deux options à trancher en discuss : (a) PWA premier-plan seulement (dégradé, écran allumé) ; (b) coupler à l'app native Phase 07 (seul suivi continu fiable).
**Hors périmètre**: géoloc certifiée Assurance maladie / alimentation facturation SEFi (DEC-074 — incombe à la solution certifiée du taxi).
**Estimation**: à cadrer en discuss
**UI hint**: yes (carte cockpit live + ETA)
**Plans**: TBD — `/gsd-discuss-phase 10`

---
*Roadmap initialisée : 2026-05-06*
*Dernière mise à jour : 2026-05-22 — renumérotation état bêta : HDS repoussée en Phase 09 (ex-06.5, pré-production commerciale) et géoloc opérationnelle en Phase 10 (ex-08, suit HDS) ; ajout Phase 06.9 Modernisation Next.js 15 (autonome, DEC-076) ; DEC-076/077/078 (stratégie stack, HDS repoussé, accessibilité) en CANDIDATE ; nouvel ADR-007. Ordre des phases restantes : 06.7 → 06.9 → 07 (optionnel) → 09 → 10. Antérieur : 2026-05-22 — sync réel (04.5/04.7 livrées), recadrage réglementaire 2027 (SEFi/géoloc certifiée, DEC-074), Phase 08 géoloc post-HDS (DEC-075). 2026-05-14 — Phase 04 livrée + hotfixes DEC-029..033 + Phase 03.2 + Phase 07.*
