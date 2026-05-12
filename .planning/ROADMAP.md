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
- [x] **Phase 1: Référentiel patients** - Fiche patient avec NIR chiffré, recherche fuzzy, préférences (livré 16 commits, 5/5 SC + 7/7 PAT delivered, runtime CI human_needed)
- [x] **Phase 1.5: DPA + RGPD compliance** - Registre traitements, DPA Supabase, DPIA santé, portail droits patient (livré 28 commits, 8/8 DPA delivered, runtime CI human_needed)
- [x] **Phase 0.7: Déploiement continu Vercel + démo seedée** - Visible Progress Mandate (Vercel preview + seed démo 974 + showcase/ + smoke test cloud) — livrée 2026-05-07
- [x] **Phase 2: Saisie express course** - Saisie < 30 s, raccourci `Cmd/Ctrl+Shift+K`, brouillons, multi-saisies (livré 22 commits, 6/6 SAIS delivered, 2026-05-07)
- [x] **Phase 03: E2E Passe 1 — Squelette + clôture-bis** - 6 maillons reliés bout-à-bout (chauffeurs/véhicules/assignation/exécution/tarif manuel/encaissement) + édition course + role guards + 48h chauffeur + annulation + CRUD admin (livré 2026-05-12 sur branches `claude/consolidate-phase-3-validation-9Tzax` + `feat/03-cloture-bis-annulation-crud-admin`)
- [ ] **Phase 04: E2E Passe 2 — PWA + tarif CGSS auto + caisse + refonte login** - PWA installable hors-ligne 1h + tarif CGSS court trajet automatique avec override + récap caisse style Stripe Balance + refonte `/login` `/welcome` `/setup` + page `/dev` switch session
- [ ] **Phase 05: E2E Passe 3 — Récurrences + cockpit temps réel + SMS** - `packages/recurrence` 100% (dialyse 3×/sem, exceptions jours fériés 974) + cockpit régulateur Realtime Supabase + SMS rappel J-1 et J-2h via Twilio
- [ ] **Phase 06: E2E Passe 4 — HDS + OR-Tools + B2B + facturation** - Migration HDS production (Scaleway/OVHcloud) + microservice Python OR-Tools tournée + portail B2B dirigeant + facturation CGSS mensuelle PDF

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

### Phase 03.1.1: Date+time picker natif (fix forward 03.1) (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 03.1
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 03.1.1 to break down)

### Phase 04: E2E Passe 2 — PWA + tarif CGSS auto + caisse + refonte login
**Goal fonctionnel**: Le chauffeur installe l'application sur son téléphone comme une vraie app native, travaille hors-ligne pendant 1 heure et synchronise au retour réseau. Le tarif CGSS court trajet est calculé automatiquement à la clôture (forfait base + distance estimée) avec override manuel possible. La régulatrice voit un récap caisse de la journée par chauffeur.
**Goal UX**: PWA installable proprement (manifest.json complet, icônes 192/512 sans bavure, splash screen identité, theme color cohérent mode courant). Transitions natives entre `/conduite` et `/conduite/[rideId]` style iOS push (slide latéral). Indicateurs hors-ligne discrets mais visibles (point header, badge synchro). Récap caisse table dense type Stripe Balance avec totaux tabulaires en pied. Refonte `/login` `/welcome` `/setup` : layout split avec zone identité (logo, baseline produit) + form, comptes démo cliquables si DEMO_MODE, identité visuelle forte, mode nuit.
**Depends on**: Phase 03 (squelette E2E + CRUD admin déjà livrés)
**Requirements**: PRIC-01..04, CHAUF-01..04, CAIS-01..03, NFR-001..006
**Périmètre — dans**:
- Manifest PWA + service worker minimal pour `/conduite` et `/conduite/[rideId]`
- Cache des courses du jour à l'ouverture, file d'attente des mutations offline (start, end), sync au retour réseau
- Indicateurs visuels offline/synching/synced
- Calcul tarif CGSS court trajet automatique (forfait base + distance estimée OSRM externe ou fallback Haversine). Pas d'OR-Tools. Override manuel toujours possible.
- Page `/courses/caisse?date=YYYY-MM-DD` : récap encaissements de la journée par chauffeur, totaux, export CSV
- Refonte pages `/login`, `/welcome`, `/setup` (layout split, comptes démo cliquables, mode nuit)
- Page `/dev` switch session démo (déjà livrée Passe 1, à raffiner si besoin)
**Périmètre — hors** (reporté Passe 4) :
- Hors-ligne > 1 heure
- Calcul CGSS long trajet, suppléments TPMR, attente
- Push notifications, géolocalisation temps réel
- Récurrences (Passe 3)
**Success Criteria** (what must be TRUE):
  1. La PWA s'installe proprement sur iPhone et Android (icônes nettes, splash screen identité)
  2. Le chauffeur peut démarrer + clôturer une course en mode avion, et la mutation se synchronise au retour réseau
  3. Le tarif CGSS court trajet calculé automatiquement matche les cas de référence à ±0,01€
  4. Override manuel du tarif possible et tracé dans audit_logs
  5. Page `/courses/caisse` affiche les encaissements de la journée par chauffeur avec totaux
  6. Refonte `/login` capture publiable, mode nuit traité à parité
**Plans**: TBD — voir `/gsd-discuss-phase 04` puis `/gsd-plan-phase 04`
**UI hint**: yes (PWA + refonte login + caisse style Stripe Balance)

### Phase 05: E2E Passe 3 — Récurrences + cockpit temps réel + SMS
**Goal fonctionnel**: La régulatrice configure une récurrence dialyse (3×/semaine, lundi/mercredi/vendredi 08h00) et toutes les occurrences se génèrent automatiquement, en respectant les jours fériés 974 (1er mai, 20 décembre, etc.). Elle voit son cockpit temps réel (Realtime Supabase) avec courses en cours, retards, alertes. Les patients reçoivent un SMS de rappel J-1 à 18h et J-2h via Twilio.
**Goal UX**: Cockpit en table dense Linear-style avec cellules colorées par statut, mise à jour fluide sans flash (Realtime + animations subtiles). Modal récurrence avec preview des 4 prochaines occurrences. Templates SMS éditables avec preview FR/créole.
**Depends on**: Phase 04 (PWA + tarif auto)
**Requirements**: RECU-01..06, COCK-01..05, SMS-01..05, NFR-001..006
**Périmètre — dans**:
- `packages/recurrence` : moteur génération occurrences (rrule-like), 100% branches (DEC-013)
- Exceptions jours fériés 974 (table de référence + override manuel)
- Décrément bon de transport `prescription` à chaque occurrence générée
- Cockpit régulatrice `/cockpit` : Realtime Supabase, courses en cours, alertes retard
- `packages/sms` : Twilio adapter, templates personnalisables, consentement strictement vérifié (DEC-008)
- SMS rappel J-1 18h00 (cron) + J-2h (cron) avec template patient
- Tracking delivery status (sent/delivered/failed) dans `sms_message`
**Périmètre — hors** (reporté Passe 4) :
- Réception SMS patient (réponse → fiche patient)
- KPIs dirigeant
- Imprévus complexes (panne, patient absent automatique)
**Success Criteria** (what must be TRUE):
  1. La régulatrice crée une récurrence dialyse 3×/semaine et voit les occurrences dans le planning
  2. Les jours fériés 974 ne génèrent pas d'occurrence sauf override explicite
  3. Couverture `packages/recurrence` à 100% branches en CI (échec si < 100%)
  4. Le cockpit affiche les courses en cours et reflète les changements de statut sans reload
  5. Le SMS rappel J-1 part automatiquement à 18h pour tous les patients consentants
  6. Tout SMS sortant respecte le consentement actif (DEC-008) et trace dans `sms_message`
**Plans**: TBD — voir `/gsd-discuss-phase 05` puis `/gsd-plan-phase 05`
**UI hint**: yes (cockpit temps réel + modal récurrence + templates SMS)

### Phase 06: E2E Passe 4 — HDS + OR-Tools + B2B + facturation CGSS
**Goal fonctionnel**: Migration de l'hébergement vers une infra HDS-certifiée (Scaleway HDS ou OVHcloud Healthcare) avant lancement commercial. Optimisation des tournées par OR-Tools (microservice Python). Portail B2B dirigeant pour donneurs d'ordres (hôpitaux, cliniques, EHPAD). Facturation CGSS mensuelle PDF générée automatiquement.
**Goal UX**: Portail B2B avec identité visuelle propre (split layout, palette adaptée). PDF facturation CGSS conforme aux standards CPAM (en-tête société, tableau courses, totaux, mentions légales).
**Depends on**: Phase 05 (récurrences + cockpit + SMS)
**Requirements**: OPTI-01..05, ROUT-01..03, KPI-01..*, conformité réglementaire
**Périmètre — dans**:
- Migration Supabase Cloud → infra HDS (CON-001) : provisioning + migration data + bascule DNS
- `services/optimizer` : microservice Python OR-Tools, contrats client TS dans `packages/optimizer-client`
- `services/osrm` : OSRM auto-hébergé tuiles 974 + RPC distance/eta
- Portail B2B `apps/b2b` : auth séparée, dashboard donneur d'ordres, dépôt prescriptions
- Génération facturation CGSS mensuelle PDF (`@react-pdf/renderer`) avec ligne par course
- Mode dégradé (continuité de service en panne réseau / Supabase / tiers)
- Audit grep CI pour NFR-001 (noms propres) + NFR-003 (spacing scale)
**Périmètre — hors** (reporté V2) :
- Push notifications natives
- Dépôt patient sans organisation
- Multi-langue
**Success Criteria** (what must be TRUE):
  1. Production hébergée chez un fournisseur HDS-certifié, audit conformité passé
  2. OR-Tools optimise une tournée de 20 courses en < 5 secondes avec contraintes (TPMR, fenêtres horaires)
  3. Portail B2B opérationnel pour 1 donneur d'ordres pilote (hôpital ou clinique)
  4. PDF facturation CGSS mensuelle généré et accepté par CPAM Réunion (validation pilote)
  5. Mode dégradé : l'application continue à enregistrer les courses en local pendant > 5 min de coupure réseau
**Plans**: TBD — voir `/gsd-discuss-phase 06` puis `/gsd-plan-phase 06`
**UI hint**: yes (portail B2B + PDF facturation)

---

## Dépendance des fonctionnalités héritées (pré-pivot)

Liste des modules CDC v2 qui n'ont pas (encore) de phase dédiée dans la
roadmap E2E v2. Ils sont implicitement traités dans une des passes 03-06,
ou explicitement reportés au-delà de V1.

| Module CDC v2 | Statut nouveau séquencement |
|---|---|
| Planning Gantt drag-and-drop | Reporté V2 (cockpit Passe 3 fournit la base, Gantt = enrichissement post-V1) |
| Géolocalisation temps réel chauffeur | Reporté V3 (Passe 4 ne livre pas le streaming GPS — V1 ne le requiert pas) |
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

---
*Roadmap initialisée : 2026-05-06*
*Dernière mise à jour : 2026-05-12 — réécriture passes 03-06 alignées ADR-003 + pivot E2E v2 (ingest run 2026-05-12, manifest 3 SPECs).*
