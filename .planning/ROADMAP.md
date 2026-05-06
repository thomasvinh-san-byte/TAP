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

- [x] **Phase 0 : Fondations Lot 0** - Monorepo, RLS multi-tenant, migrations, CI/CD (livré commit `f68b1d2`)
- [ ] **Phase 1 : Référentiel patients** - Fiche patient avec NIR chiffré, recherche fuzzy, préférences
- [ ] **Phase 2 : Saisie express course** - Saisie < 30 s, raccourci `Cmd/Ctrl+N`, brouillons, multi-saisies
- [ ] **Phase 3 : Moteur tarification CGSS** - `packages/pricing` versionné, 100 % branches couvert
- [ ] **Phase 4 : Moteur récurrences** - `packages/recurrence`, exceptions jours fériés 974, 100 % branches
- [ ] **Phase 5 : Cockpit régulatrice temps réel** - Écran d'accueil, blocs courses + alertes, TTI < 2 s
- [ ] **Phase 6 : Planning Gantt drag-and-drop** - Vue par chauffeur et par jour, réaffectation visuelle
- [ ] **Phase 7 : Gestion des imprévus** - Workflows panne, patient absent, réaffectation temps réel
- [ ] **Phase 8 : Communication SMS patient** - `packages/sms`, consentement actif, templates, delivery
- [ ] **Phase 9 : PWA chauffeur** - `apps/mobile` complète : terrain, hors-ligne, vocal, mode soleil
- [ ] **Phase 10 : Optimisation des tournées** - Microservice Python OR-Tools + client TS
- [ ] **Phase 11 : Routing GPS OSRM** - OSRM auto-hébergé, MapLibre + tuiles OSM
- [ ] **Phase 12 : Caisse et paiements directs** - Encaissements cash / CB / chèque, rapprochement
- [ ] **Phase 13 : Mode dégradé** - Continuité de service en panne réseau / Supabase / tiers

## Phase Details

### Phase 0 : Fondations Lot 0
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

### Phase 1 : Référentiel patients
**Goal**: La régulatrice peut créer, consulter, rechercher et annoter une fiche patient avec un NIR chiffré et des préférences exploitables par les autres modules.
**Depends on**: Phase 0
**Requirements**: PAT-01, PAT-02, PAT-03, PAT-04, PAT-05, PAT-06, PAT-07
**Success Criteria** (what must be TRUE):
  1. La régulatrice peut créer une fiche patient en remplissant un formulaire validé par zod
  2. Le NIR est stocké chiffré AES-256-GCM, jamais visible en base claire ni dans les logs
  3. Une recherche à 2 caractères (nom, prénom, ou téléphone) retourne instantanément les patients correspondants en fuzzy
  4. La régulatrice peut renseigner les préférences patient (SMS / appel / aucun) et une note opérationnelle libre
  5. Toute création ou modification de fiche patient apparaît dans `audit_logs` avec utilisateur, horodatage et delta
**Plans**: TBD
**UI hint**: yes

### Phase 2 : Saisie express course
**Goal**: La régulatrice peut saisir une course en mode express en moins de 30 secondes, avec brouillons en file d'attente et multi-saisies parallèles, sans jamais être bloquée par un appel entrant.
**Depends on**: Phase 1
**Requirements**: SAIS-01, SAIS-02, SAIS-03, SAIS-04, SAIS-05, SAIS-06
**Success Criteria** (what must be TRUE):
  1. Un test E2E Playwright mesure la saisie complète d'une course type en moins de 30 secondes
  2. Le raccourci `Cmd/Ctrl+N` ouvre la saisie express depuis n'importe quel écran régulateur
  3. La régulatrice peut mettre une saisie en pause, ouvrir une autre saisie, puis reprendre la première sans perte de données
  4. La recherche patient dans le formulaire retourne des résultats à 2 caractères en fuzzy
  5. Toute course créée écrit une ligne d'audit dans `audit_logs`
**Plans**: TBD
**UI hint**: yes

### Phase 3 : Moteur tarification CGSS
**Goal**: Toute course créée dispose d'un calcul tarifaire CGSS exact, déterministe, versionné et 100 % couvert par les tests, isolé dans `packages/pricing`.
**Depends on**: Phase 2
**Requirements**: PRIC-01, PRIC-02, PRIC-03, PRIC-04
**Success Criteria** (what must be TRUE):
  1. Le calcul tarifaire d'une course (base, suppléments, mutualisation, à vide) renvoie un résultat exact et identique à des cas de référence CGSS validés
  2. Les grilles tarifaires sont versionnées (`tariff_grid` avec date d'effet) et le calcul utilise toujours la grille active à la date de la course
  3. La couverture de tests `packages/pricing` atteint 100 % de branches en CI (échec si < 100 %)
  4. Aucun calcul tarifaire n'existe ailleurs que dans `packages/pricing` (audit grep en CI)
  5. Toute modification de paramètre tarifaire écrit une ligne dans `audit_logs`

### Phase 4 : Moteur récurrences
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

### Phase 5 : Cockpit régulatrice temps réel
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

### Phase 6 : Planning Gantt drag-and-drop
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

### Phase 7 : Gestion des imprévus
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

### Phase 8 : Communication SMS patient
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

### Phase 9 : PWA chauffeur
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

### Phase 10 : Optimisation des tournées
**Goal**: Le microservice Python OR-Tools propose des tournées optimisées et des opportunités de mutualisation (spatiale ou temporelle) à la régulatrice, exposé via un client TS typé.
**Depends on**: Phase 9
**Requirements**: OPTI-01, OPTI-02, OPTI-03, OPTI-04, OPTI-05
**Success Criteria** (what must be TRUE):
  1. Le service `services/optimizer` reçoit une liste de courses + chauffeurs et renvoie une affectation optimisée respectant les contraintes métier
  2. Le client `packages/optimizer-client` expose des types TS générés et est utilisé par `apps/web` pour appeler le service
  3. La régulatrice voit dans le cockpit ou le planning des suggestions de mutualisation (gain estimé en km / temps)
  4. Les tests pytest du service couvrent les cas critiques (mutualisation impossible, contraintes TPMR, fenêtres horaires)

### Phase 11 : Routing GPS OSRM
**Goal**: Tous les calculs d'itinéraires (durée, distance, géométrie) reposent sur un OSRM auto-hébergé, exposé aux apps via MapLibre et tuiles OSM, sans dépendance à un service tiers payant.
**Depends on**: Phase 10
**Requirements**: ROUT-01, ROUT-02, ROUT-03
**Success Criteria** (what must be TRUE):
  1. Le service `services/osrm` est opérationnel avec données OSM 974 chargées
  2. Les apps web et mobile affichent des itinéraires via MapLibre, sans dépendance à Google Maps ou Mapbox
  3. Le calcul de durée / distance d'une course repose exclusivement sur OSRM (audit grep en CI sur dépendances payantes interdites)
**Plans**: TBD
**UI hint**: yes

### Phase 12 : Caisse et paiements directs
**Goal**: La régulatrice et la dirigeante peuvent enregistrer les encaissements directs (cash, CB, chèque) rattachés à une course ou un patient, et faire un rapprochement de fin de journée.
**Depends on**: Phase 11
**Requirements**: CAIS-01, CAIS-02, CAIS-03
**Success Criteria** (what must be TRUE):
  1. Un encaissement peut être enregistré sur une course ou un patient avec mode (cash / CB / chèque), montant, horodatage
  2. Un rapport de rapprochement de fin de journée affiche le total encaissé par mode et par chauffeur
  3. Tout encaissement écrit une ligne dans `audit_logs` avec utilisateur et delta
**Plans**: TBD
**UI hint**: yes

### Phase 13 : Mode dégradé
**Goal**: Si Supabase Realtime, la connexion réseau ou un service tiers tombe, l'outil reste utilisable pour les actions critiques (consultation planning régulateur, clôture course chauffeur) avec indicateur explicite à l'utilisateur.
**Depends on**: Phase 12
**Requirements**: DEGR-01, DEGR-02, DEGR-03
**Success Criteria** (what must be TRUE):
  1. Si Supabase Realtime tombe, la régulatrice peut toujours consulter le planning et créer une course ; un bandeau « mode dégradé » s'affiche
  2. Si le réseau tombe côté chauffeur, il peut clore sa course en cours ; la sync se fait au retour réseau avec compteur d'éléments en attente
  3. Aucune action critique ne se solde par une erreur technique brute affichée à l'utilisateur ; tout est reformulé en français
**Plans**: TBD
**UI hint**: yes

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
