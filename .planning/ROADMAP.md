# Roadmap : SaaS TAP Réunion

## Overview

Le produit se construit en 3 lots successifs livrés à des design partners.
Le **Lot 0** (fondations multi-tenant, RLS, CI/CD) est terminé. Le **Lot 1**
ouvre la valeur métier à la régulatrice : référentiel patients, saisie express,
moteur tarifaire CGSS, courses récurrentes, cockpit temps réel. Le **Lot 2**
amène la beta auprès du premier design partner régulateur : planning Gantt,
imprévus temps réel, communication SMS patient. Le **Lot 3** ouvre le terrain
chauffeur (PWA hors-ligne, optimisation OR-Tools, routing OSRM) et finalise
les capacités opérationnelles (caisse, mode dégradé). Le pilier UX prime à
chaque phase : aucun écran ne sort si la régulatrice ne pourrait pas en faire
une capture pour une page d'accueil produit.

## Phases

**Numérotation :**
- Phases entières (0, 1, 2…) : milestones planifiés.
- Phases décimales (2.1, 2.2…) : insertions urgentes (marquées INSERTED).

- [x] **Phase 0: Fondations Lot 0** - Monorepo, RLS multi-tenant, migrations, CI/CD (livré commit `f68b1d2`)
- [x] **Phase 1: Référentiel patients** - Fiche patient avec NIR chiffré, recherche fuzzy, préférences (livré 16 commits, 5/5 SC + 7/7 PAT delivered, runtime CI human_needed)
- [x] **Phase 1.5: DPA + RGPD compliance** - Registre traitements, DPA Supabase, DPIA santé, portail droits patient (livré 28 commits, 8/8 DPA delivered, runtime CI human_needed)
- [x] **Phase 0.7: Déploiement continu Vercel + démo seedée** - Visible Progress Mandate (Vercel preview + seed démo 974 + showcase/ + smoke test cloud) — livrée 2026-05-07
- [x] **Phase 2: Saisie express course** - Saisie < 30 s, raccourci `Cmd/Ctrl+Shift+K`, brouillons, multi-saisies (livré 22 commits, 6/6 SAIS delivered, 2026-05-07)
- [ ] **Phase 3: Moteur tarification CGSS** - `packages/pricing` versionné, 100 % branches couvert
- [ ] **Phase 4: Moteur récurrences** - `packages/recurrence`, exceptions jours fériés 974, 100 % branches
- [ ] **Phase 4.5: Bootstrap OSRM** - `services/osrm` Docker + tuiles OSM 974 + RPC distance/eta (parallélise Lot 1, débloque Phases 9, 10, 12)
- [ ] **Phase 5: Cockpit régulatrice temps réel** - Écran d'accueil, blocs courses + alertes, TTI < 2 s
- [ ] **Phase 6: Planning Gantt drag-and-drop** - Vue par chauffeur et par jour, réaffectation visuelle
- [ ] **Phase 7: Gestion des imprévus** - Workflows panne, patient absent, réaffectation temps réel
- [ ] **Phase 8: Communication SMS patient** - `packages/sms`, consentement actif, templates, delivery
- [ ] **Phase 9: PWA chauffeur** - `apps/mobile` complète : terrain, hors-ligne, vocal, mode soleil
- [ ] **Phase 9.5: Géolocalisation temps réel** - Capture position chauffeur + streaming Realtime cockpit + rétention 90j
- [ ] **Phase 10: Optimisation des tournées** - Microservice Python OR-Tools + client TS
- [ ] **Phase 11: Routing GPS OSRM (advanced)** - Geocoding inverse, alternatives, isochrones (Phase 4.5 a déjà livré OSRM bootstrap)
- [ ] **Phase 12: Caisse et paiements directs** - Encaissements cash / CB / chèque, rapprochement
- [ ] **Phase 13: Mode dégradé** - Continuité de service en panne réseau / Supabase / tiers (transverse)
- [ ] **Phase 14: KPIs dirigeant** - CA, marge, mutualisation, productivité chauffeur, drill-down + comparatifs M-1/M-12
- [ ] **Phase 15: Conformité réglementaire** - Alertes 90/60/30j carte pro, CT véhicule, visite médicale, agrément ARS/CPAM
- [ ] **Phase 16: Exports comptables et intégrations** - FEC annuel DGFiP, Lomaco CSV mensuel, PDF récap mensuel, B2B mensuel
- [ ] **Phase 17: Beta terrain chauffeur** *(V1.5)* - Validation Hauts Réunion (35°C cockpit, 3G dégradé, 2-3 design partners)

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

### Phase 3: Moteur tarification CGSS
**Goal**: Toute course créée dispose d'un calcul tarifaire CGSS exact, déterministe, versionné et 100 % couvert par les tests, isolé dans `packages/pricing`.
**Depends on**: Phase 2
**Requirements**: PRIC-01, PRIC-02, PRIC-03, PRIC-04
**Success Criteria** (what must be TRUE):
  1. Le calcul tarifaire d'une course (base, suppléments, mutualisation, à vide) renvoie un résultat exact et identique à des cas de référence CGSS validés
  2. Les grilles tarifaires sont versionnées (`tariff_grid` avec date d'effet) et le calcul utilise toujours la grille active à la date de la course
  3. La couverture de tests `packages/pricing` atteint 100 % de branches en CI (échec si < 100 %)
  4. Aucun calcul tarifaire n'existe ailleurs que dans `packages/pricing` (audit grep en CI)
  5. Toute modification de paramètre tarifaire écrit une ligne dans `audit_logs`

### Phase 4: Moteur récurrences
**Goal**: La régulatrice peut configurer un schéma de récurrence (dialyse 3×/sem, chimio) et obtenir des occurrences générées automatiquement avec exceptions jours fériés 974, 100 % couvert par les tests, isolé dans `packages/recurrence`.
**Depends on**: Phase 3
**Requirements**: RECU-01, RECU-02, RECU-03, RECU-04, RECU-05, RECU-06
**Success Criteria** (what must be TRUE):
  1. La régulatrice peut créer une récurrence (jours, fréquence, plage horaire, durée de validité) et voir les occurrences générées dans le planning
  2. Les jours fériés 974 (1er mai, 20 décembre Abolition de l'esclavage, etc.) ne génèrent pas d'occurrence sauf override explicite
  3. Une exception sur une occurrence (`ride_recurrence_exception`) est visible dans le planning sans casser la série
  4. Chaque occurrence générée décrémente le bon de transport associé (`prescription`)
  5. La couverture de tests `packages/recurrence` atteint 100 % de branches en CI
**Plans**: TBD

### Phase 4.5: Bootstrap OSRM
**Goal**: Avoir un service `osrm` auto-hébergé opérationnel (Docker + tuiles OSM 974) accessible via RPC interne pour le calcul de distances et ETA, débloquant Phases 9 (PWA), 10 (optimizer) et 12 (caisse — calcul facturation au km). Bootstrap minimal volontairement court (~1 jour de dev), les features avancées (geocoding inverse, isochrones) restent en Phase 11.
**Depends on**: Phase 0 (infra Docker dispo) — peut tourner en parallèle avec Phases 3 et 4
**Requirements**: OSRM-bootstrap-01, OSRM-bootstrap-02, OSRM-bootstrap-03
**Success Criteria** (what must be TRUE):
  1. `docker compose up osrm` démarre le service localement et en CI
  2. Les tuiles OSM Réunion (974) sont préparées et chargées au démarrage
  3. Une RPC `route(origin, destination)` retourne distance + ETA en < 50 ms en moyenne (mesuré CI)
  4. La consommation depuis `apps/web` ou microservices passe par un wrapper typé `packages/osrm-client`
**Plans**: TBD
**Tag**: Infra/légal — débloque downstream

### Phase 5: Cockpit régulatrice temps réel
**Goal**: À la connexion, la régulatrice ouvre par défaut un cockpit temps réel qui charge en moins de 2 secondes et reflète instantanément les changements (nouvelles courses, statuts chauffeur, alertes) sans flash ni reload.
**Depends on**: Phase 4
**Requirements**: COCK-01, COCK-02, COCK-03, COCK-04, COCK-05, COCK-06
**Success Criteria** (what must be TRUE):
  1. À la connexion régulatrice, le cockpit s'affiche par défaut sans navigation supplémentaire
  2. Un test Playwright mesure le Time to Interactive du cockpit < 2 secondes en condition réseau standard
  3. Une nouvelle course créée dans une autre session apparaît dans le cockpit en fade-in subtil < 1 seconde, sans reload
  4. Le bloc « courses du jour » affiche statut chauffeur, patient, statut course pour chaque course planifiée
  5. Le bloc « alertes » affiche en temps réel les retards, imprévus signalés et SMS échoués
**Plans**: TBD
**UI hint**: yes

### Phase 6: Planning Gantt drag-and-drop
**Goal**: La régulatrice dispose d'une vue planning Gantt par chauffeur et par jour, et peut réaffecter une course d'un chauffeur à un autre par simple drag-and-drop, avec mutualisation visible.
**Depends on**: Phase 5
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04
**Success Criteria** (what must be TRUE):
  1. La régulatrice voit toutes les courses du jour groupées par chauffeur dans une vue Gantt horizontale
  2. La régulatrice peut glisser-déposer une course depuis un chauffeur vers un autre, avec confirmation visuelle < 100 ms
  3. Les courses mutualisées (plusieurs patients dans le même véhicule) sont visuellement distinctes des courses simples
  4. Toute réaffectation produit une ligne dans `audit_logs` avec ancien chauffeur, nouveau chauffeur, horodatage
**Plans**: TBD
**UI hint**: yes

### Phase 7: Gestion des imprévus
**Goal**: Les workflows critiques de la vie réelle (patient absent, panne véhicule, réaffectation course) sont traités de bout en bout en temps réel entre régulatrice et chauffeur, avec décisions tracées.
**Depends on**: Phase 6
**Requirements**: IMPV-01, IMPV-02, IMPV-03, IMPV-04
**Success Criteria** (what must be TRUE):
  1. Un chauffeur peut signaler « patient absent » depuis la PWA ; la régulatrice voit l'alerte instantanément et peut décider (annuler, reprogrammer, attendre)
  2. En cas de panne véhicule signalée, la régulatrice peut réaffecter la course en cours et notifier le patient via SMS
  3. Une réaffectation propage en temps réel les changements de planning aux chauffeurs concernés
  4. Les 3 workflows imprévus passent des tests E2E Playwright sans régression
**Plans**: TBD
**UI hint**: yes

### Phase 8: Communication SMS patient
**Goal**: La régulatrice peut envoyer des SMS patients (rappel veille, retard, annulation) uniquement aux patients ayant donné consentement actif, via templates personnalisables, avec statut delivery archivé.
**Depends on**: Phase 7
**Requirements**: SMS-01, SMS-02, SMS-03, SMS-04, SMS-05, SMS-06, SMS-07
**Success Criteria** (what must be TRUE):
  1. Aucun SMS n'est envoyé à un patient sans consentement actif horodaté ; tentative bloquée avec message clair
  2. Le numéro expéditeur affiché côté patient est le numéro pro de la société, pas un numéro générique
  3. Les templates SMS (rappel veille, retard, annulation) sont éditables par la régulatrice et personnalisés à l'envoi
  4. Le statut delivery (envoyé, livré, échoué, réponse) est archivé dans la fiche patient
  5. Les patients avec préférence « appel » ou « aucun » ne reçoivent jamais de SMS
  6. Tout envoi SMS écrit une ligne dans `audit_logs`
**Plans**: TBD
**UI hint**: yes

### Phase 9: PWA chauffeur
**Goal**: Le chauffeur dispose d'une PWA mobile utilisable au volant ou en tournée, hors-ligne, vocale au démarrage de course, lisible au soleil, avec maximum 3 informations à l'écran et confirmations par swipe.
**Depends on**: Phase 8
**Requirements**: CHAUF-01, CHAUF-02, CHAUF-03, CHAUF-04, CHAUF-05, CHAUF-06, CHAUF-07, CHAUF-08, CHAUF-09, CHAUF-10, CHAUF-11, CHAUF-12
**Success Criteria** (what must be TRUE):
  1. Sur iPhone SE (375 px), tous les boutons d'action principale font ≥ 56 px de hauteur et le texte ≥ 18 px
  2. Le chauffeur peut démarrer et clore une course hors-ligne ; la sync se fait automatiquement au retour réseau, avec indicateur explicite
  3. Au démarrage d'une course, le nom du patient et l'adresse sont lus à voix haute (TTS)
  4. Le chauffeur ne voit que ses propres tournées (vérifié par tests RLS pgTAP)
  5. Une action confirmée côté chauffeur (par swipe) affiche un retour visuel < 1 seconde même en simulation 3G
  6. Le mode contraste élevé et la police +20 % sont activables depuis les réglages
**Plans**: TBD
**UI hint**: yes

### Phase 9.5: Géolocalisation temps réel
**Goal**: La position du chauffeur est capturée pendant le service uniquement, streamée en temps réel au cockpit régulatrice via Supabase Realtime, et conservée 90 jours en base chaude avant agrégation et purge automatique. Couche transverse consommée par cockpit (Phase 5), planning Gantt (Phase 6), KPIs (Phase 14).
**Depends on**: Phase 9 (PWA chauffeur capture la position) ET Phase 5 (cockpit existe pour afficher le tracker)
**Requirements**: GEO-01, GEO-02, GEO-03, GEO-04
**Success Criteria** (what must be TRUE):
  1. Le chauffeur capture sa position uniquement quand il est en service (DEC-009 — toggle ON par défaut au login, OFF déconnexion)
  2. Le cockpit régulatrice affiche un tracker live (carte MapLibre + dot + heading) avec rafraîchissement < 5 s
  3. Les positions sont retenues 90 jours en base chaude (`driver_location`), agrégées au-delà puis purgées automatiquement
  4. Un indicateur explicite « tracking actif » est visible dans la PWA chauffeur en permanence
**Plans**: TBD
**UI hint**: yes

### Phase 10: Optimisation des tournées
**Goal**: Le microservice Python OR-Tools propose des tournées optimisées et des opportunités de mutualisation (spatiale ou temporelle) à la régulatrice, exposé via un client TS typé.
**Depends on**: Phase 9
**Requirements**: OPTI-01, OPTI-02, OPTI-03, OPTI-04, OPTI-05
**Success Criteria** (what must be TRUE):
  1. Le service `services/optimizer` reçoit une liste de courses + chauffeurs et renvoie une affectation optimisée respectant les contraintes métier
  2. Le client `packages/optimizer-client` expose des types TS générés et est utilisé par `apps/web` pour appeler le service
  3. La régulatrice voit dans le cockpit ou le planning des suggestions de mutualisation (gain estimé en km / temps)
  4. Les tests pytest du service couvrent les cas critiques (mutualisation impossible, contraintes TPMR, fenêtres horaires)

### Phase 11: Routing GPS OSRM (advanced features)
**Goal**: Compléter Phase 4.5 (OSRM bootstrap) avec les features avancées : geocoding inverse (lat/lng → adresse postale formatée), itinéraires alternatifs (3 propositions classées par durée), isochrones (zones atteignables en X minutes pour optimisation tournées). Sans dépendance à un service tiers payant.
**Depends on**: Phase 4.5 (OSRM service tourne déjà), Phase 10 (optimizer consomme isochrones)
**Requirements**: ROUT-01, ROUT-02, ROUT-03
**Success Criteria** (what must be TRUE):
  1. Geocoding inverse opérationnel via Nominatim ou équivalent auto-hébergé
  2. Itinéraires alternatifs renvoyés par OSRM (3 propositions classées) consommés par PWA chauffeur
  3. Isochrones consommés par l'optimizer pour mutualisation temporelle
  4. Aucune dépendance à Google Maps ou Mapbox (audit grep en CI)
**Plans**: TBD
**UI hint**: yes

### Phase 12: Caisse et paiements directs
**Goal**: La régulatrice et la dirigeante peuvent enregistrer les encaissements directs (cash, CB, chèque) rattachés à une course ou un patient, et faire un rapprochement de fin de journée.
**Depends on**: Phase 11
**Requirements**: CAIS-01, CAIS-02, CAIS-03
**Success Criteria** (what must be TRUE):
  1. Un encaissement peut être enregistré sur une course ou un patient avec mode (cash / CB / chèque), montant, horodatage
  2. Un rapport de rapprochement de fin de journée affiche le total encaissé par mode et par chauffeur
  3. Tout encaissement écrit une ligne dans `audit_logs` avec utilisateur et delta
**Plans**: TBD
**UI hint**: yes

### Phase 13: Mode dégradé
**Goal**: Si Supabase Realtime, la connexion réseau ou un service tiers tombe, l'outil reste utilisable pour les actions critiques (consultation planning régulateur, clôture course chauffeur) avec indicateur explicite à l'utilisateur.
**Depends on**: Phase 12
**Requirements**: DEGR-01, DEGR-02, DEGR-03
**Success Criteria** (what must be TRUE):
  1. Si Supabase Realtime tombe, la régulatrice peut toujours consulter le planning et créer une course ; un bandeau « mode dégradé » s'affiche
  2. Si le réseau tombe côté chauffeur, il peut clore sa course en cours ; la sync se fait au retour réseau avec compteur d'éléments en attente
  3. Aucune action critique ne se solde par une erreur technique brute affichée à l'utilisateur ; tout est reformulé en français
**Plans**: TBD
**UI hint**: yes

### Phase 14: KPIs dirigeant
**Goal**: Le dirigeant dispose d'un tableau de bord exécutif avec CA mensuel, marge brute, taux de mutualisation, productivité chauffeur (km/h, courses/jour), drill-down par chauffeur / véhicule / donneur d'ordres, et comparatifs M-1 et M-12. Les données proviennent de `ride`, `ride_billing`, `ride_execution`, `ride_payment` (Phases 3, 7, 12) — donc dépend de leur livraison.
**Depends on**: Phase 12 (données financières) ET Phase 9.5 (géolocalisation pour productivité km/h)
**Requirements**: KPI-01, KPI-02, KPI-03, KPI-04, KPI-05, KPI-06
**Success Criteria** (what must be TRUE):
  1. Le dashboard exécutif affiche CA mensuel par société et par donneur d'ordres avec comparatif M-1 et M-12
  2. La marge brute estimée (recettes - coûts directs : essence/km, salaire chauffeur estimé, péages éventuels) est calculée par course
  3. Le taux de mutualisation (% courses mutualisées / total courses) est mesuré et exposé au dashboard
  4. La productivité chauffeur (km parcourus, nombre de courses, ratio temps roulé / temps service) est calculée par chauffeur
  5. Un drill-down permet de filtrer par chauffeur, par véhicule, par donneur d'ordres et de remonter à la course individuelle
  6. Un export PDF mensuel est généré automatiquement et envoyé au dirigeant
**Plans**: TBD
**UI hint**: yes

### Phase 15: Conformité réglementaire
**Goal**: Le système suit les dates d'expiration des credentials métier (carte pro chauffeur, certificat de capacité professionnelle, contrôle technique véhicule, visite médicale chauffeur, agrément ARS pour VSL, convention CPAM/CGSS pour taxi conventionné) et déclenche des alertes anticipées (90j, 60j, 30j) à la régulatrice et au dirigeant. L'assignation d'une course est automatiquement bloquée si une credential critique est expirée.
**Depends on**: Phase 5 (cockpit existant pour afficher alertes), Phase 8 (SMS pour alertes critiques)
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05, CONF-06
**Success Criteria** (what must be TRUE):
  1. Les credentials chauffeur (carte pro, CCP, visite médicale) et véhicule (CT, agrément ARS, assurance) sont saisissables avec date d'expiration
  2. Des alertes 90j / 60j / 30j sont affichées au cockpit régulateur ET envoyées par email au dirigeant
  3. L'assignation d'une course à un chauffeur dont la carte pro est expirée est bloquée automatiquement avec message clair
  4. Le contrôle technique annuel obligatoire pour TAP/VSL (rappel : 1 an pour TAP/VSL vs 2 ans pour véhicule particulier) est tracké séparément
  5. Une UI admin permet la mise à jour idempotente des credentials avec audit log
  6. Tests E2E couvrent le flow alerte → renouvellement → débloquage assignation
**Plans**: TBD
**Tag**: Infra/légal — bloque la mise en production commerciale
**UI hint**: yes

### Phase 16: Exports comptables et intégrations
**Goal**: Le SaaS produit les exports comptables réglementaires (FEC obligatoire DGFiP) et d'interopérabilité avec les outils du marché (Lomaco CSV pour cabinet expert-comptable transport sanitaire, PDF récapitulatif mensuel pour dirigeant et donneurs d'ordres B2B). Schedule mensuel automatique avec envoi email au DPO et à l'expert-comptable.
**Depends on**: Phase 12 (données financières complètes), Phase 14 (calculs comptables consolidés)
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Success Criteria** (what must be TRUE):
  1. L'export FEC annuel est généré au format DGFiP (.txt pipe-separated, ordre chronologique, colonnes imposées Livre des Procédures Fiscales) et passe la validation FEC officielle
  2. L'export Lomaco CSV mensuel est généré dans le format attendu par Lomaco (logiciel propriétaire transport sanitaire) et est testé en intégration avec un cabinet expert-comptable design partner
  3. Un PDF récapitulatif mensuel par société et par donneur d'ordres est généré
  4. Le schedule mensuel envoie automatiquement les exports au DPO et à l'expert-comptable par email avec accusé de réception
  5. Les exports sont signés (hash SHA-256 + horodatage) pour traçabilité légale
**Plans**: TBD

### Phase 17: Beta terrain chauffeur (V1.5)
**Goal**: Valider la PWA chauffeur en conditions terrain réelles dans les Hauts de La Réunion (35°C cockpit véhicule, 3G dégradé, batterie en chute libre) avec 2-3 chauffeurs design partners (Plaine des Cafres, Cilaos ou Salazie). Itérer directement sur Phase 9 selon les retours mesurés. Cette phase est moins du code et plus de la validation produit (~2-3 semaines).
**Depends on**: Phase 9 (PWA chauffeur livrée), Phase 9.5 (géolocalisation), Phase 13 (mode dégradé fonctionnel pour 3G dégradé)
**Requirements**: BETA-01, BETA-02, BETA-03, BETA-04, BETA-05
**Success Criteria** (what must be TRUE):
  1. 2-3 chauffeurs design partners installés dans les Hauts (Plaine des Cafres, Cilaos, Salazie) utilisent la PWA quotidiennement pendant ≥ 2 semaines
  2. Le mode soleil (contraste élevé) est testé en cockpit véhicule par 35°C : taux d'erreur tactile mesuré et < 5 %
  3. La sync différée 3G dégradé est testée sur les routes des Hauts : taux de drops sync mesuré et < 1 % avec recovery automatique
  4. La consommation batterie d'une tournée 8h est mesurée et < 30 % d'une charge full (smartphone milieu de gamme)
  5. Au moins 5 itérations PWA Phase 9 sont livrées suite aux retours terrain (V1.5.1, V1.5.2, ...)
**Plans**: TBD
**Tag**: Terrain / beta — validation produit avant scale-up

## Progress

**Execution Order:**
Les phases s'exécutent dans l'ordre numérique. Phase 0 livrée, Phase 1 prête à démarrer.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Fondations Lot 0 | n/a | Complete | 2026-05-06 |
| 1. Référentiel patients | 0/TBD | Not started | - |
| 2. Saisie express course | 0/TBD | Not started | - |
| 3. Moteur tarification CGSS | 0/TBD | Not started | - |
| 4. Moteur récurrences | 0/TBD | Not started | - |
| 5. Cockpit régulatrice temps réel | 0/TBD | Not started | - |
| 6. Planning Gantt drag-and-drop | 0/TBD | Not started | - |
| 7. Gestion des imprévus | 0/TBD | Not started | - |
| 8. Communication SMS patient | 0/TBD | Not started | - |
| 9. PWA chauffeur | 0/TBD | Not started | - |
| 10. Optimisation des tournées | 0/TBD | Not started | - |
| 11. Routing GPS OSRM | 0/TBD | Not started | - |
| 12. Caisse et paiements directs | 0/TBD | Not started | - |
| 13. Mode dégradé | 0/TBD | Not started | - |

## Métriques de succès produit

Mesurées en continu à partir de la Phase 1, comparées aux objectifs de Guillaume :

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Saisie d'une course en mode express | < 30 secondes | E2E Playwright sur SAIS-01 (Phase 2) |
| Taux de mutualisation des courses | > 30 % | Métrique métier remontée du cockpit (Phase 10) |
| Couverture tests `packages/pricing` | 100 % branches | CI (Phase 3) |
| Couverture tests `packages/recurrence` | 100 % branches | CI (Phase 4) |
| Time to first deploy d'un nouveau module | < 1 jour | Vélocité monorepo (mesurée à partir de la Phase 1) |
