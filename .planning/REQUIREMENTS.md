# Requirements : SaaS TAP Réunion

**Defined:** 2026-05-06
**Core Value:** La régulatrice doit avoir envie d'utiliser l'outil 8 h/jour, 220 j/an, sans jamais le subir.

> Note : les requirements ci-dessous proviennent de l'ingest des 2 ADRs et de
> CLAUDE.md. Le **CDC v2** (`docs/cahier_des_charges_saas_tap_v2.docx`)
> contient 24 modules fonctionnels — 9 modules critiques sont couverts en V1
> ci-dessous. Les **15 modules secondaires** restent à ingérer comme PRD une
> fois le `.docx` converti en `.md`.

---

## v1 Requirements

Requirements pour la première release commerciale (livrée incrémentalement aux
design partners). Chaque requirement mappe vers exactement une phase.

### Fondations (FOND) — livrée Lot 0

- [x] **FOND-01** : Monorepo Turborepo + pnpm workspaces opérationnel (build, cache, parallélisation)
- [x] **FOND-02** : Multi-tenant via RLS forcée + `organization_id` sur toute table métier
- [x] **FOND-03** : Migrations Supabase 001 (foundations) et 002 (rls_foundations) appliquées
- [x] **FOND-04** : Tests pgTAP RLS automatisés en CI (PR bloquée si red)
- [x] **FOND-05** : Packages `database` (types Supabase) et `shared` (utils, validators zod) initialisés
- [x] **FOND-06** : ADRs versionnés (ADR-001 monorepo, ADR-002 RLS multi-tenant)
- [x] **FOND-07** : CI/CD GitHub Actions (lint, typecheck, tests, migrations validées)
- [x] **FOND-08** : Comptes de démo seedés (dirigeant, régulateur, chauffeur)

### Référentiel patients (PAT)

- [ ] **PAT-01** : Régulatrice peut créer une fiche patient avec coordonnées, NIR, date de naissance, sexe
- [ ] **PAT-02** : NIR chiffré applicativement (AES-256-GCM), clé hors Supabase, jamais loggué
- [ ] **PAT-03** : Régulatrice peut consulter une fiche patient en < 1 clic depuis la recherche
- [ ] **PAT-04** : Recherche patient fuzzy à partir de 2 caractères (nom, prénom, téléphone)
- [ ] **PAT-05** : Régulatrice peut renseigner préférences patient (SMS / appel / aucun, contraintes)
- [ ] **PAT-06** : Régulatrice peut ajouter une note opérationnelle libre (codes, particularités)
- [ ] **PAT-07** : Modifications fiche patient journalisées dans `audit_logs`

### Saisie express course (SAIS)

- [ ] **SAIS-01** : Saisie complète d'une course en mode express **< 30 s** (mesuré E2E Playwright)
- [ ] **SAIS-02** : Saisie express déclenchable par raccourci clavier global `Cmd/Ctrl+Shift+K`
- [ ] **SAIS-03** : Recherche patient instantanée à 2 caractères dans le formulaire
- [ ] **SAIS-04** : Régulatrice peut mettre une saisie en pause et y revenir (file d'attente brouillons)
- [ ] **SAIS-05** : Multi-saisies en parallèle (plusieurs brouillons ouverts simultanément, jamais bloquant)
- [ ] **SAIS-06** : Création de course écrit dans `audit_logs` (cf. DEC-010)
- [x] **SAIS-07** : Smart defaults mode + urgence depuis dernière course patient (Phase 03.1) — pré-remplissage silencieux quand le formulaire est encore aux défauts V1.
- [ ] **SAIS-08** : Chips date rapides 4 valeurs chrono.fr-compatibles (Phase 03.1) — `demain 8h`, `demain 14h`, `lundi 9h`, `dans 30 minutes`.
- [ ] **SAIS-09** : Détection doublon ±30 min non-bloquante avec bypass (Phase 03.1) — banner amber + bouton « Créer quand même ».
- [ ] **SAIS-10** : Re-seed défense en profondeur patients démo (Phase 03.1, NFR-001) — tél `02 62 99 90 XX` / `06 92 99 90 XX`, adresse `9XXX ...`.

### Tarification CGSS (PRIC)

- [ ] **PRIC-01** : Calcul tarif CGSS d'une course (base, suppléments, mutualisation, à vide) — uniquement dans `packages/pricing`
- [ ] **PRIC-02** : Versionnement des grilles tarifaires (`tariff_grid`) avec date d'effet
- [ ] **PRIC-03** : Couverture tests `packages/pricing` à **100 % branches** (cf. DEC-013)
- [ ] **PRIC-04** : Modifications de paramètres tarifaires journalisées dans `audit_logs`

### Récurrences (RECU)

- [ ] **RECU-01** : Modèle `ride_recurrence` (dialyse 3×/sem, chimio, etc.) configurable par régulatrice
- [ ] **RECU-02** : Génération des prochaines occurrences avec exceptions **jours fériés 974** (La Réunion)
- [ ] **RECU-03** : Gestion d'exceptions par occurrence (`ride_recurrence_exception`)
- [ ] **RECU-04** : Décrément automatique du bon de transport (`prescription`) lors de la génération
- [ ] **RECU-05** : Couverture tests `packages/recurrence` à **100 % branches** (cf. DEC-013)
- [ ] **RECU-06** : Génération et modification de récurrences journalisées dans `audit_logs`

### Cockpit régulatrice (COCK)

- [ ] **COCK-01** : Cockpit temps réel = écran d'accueil par défaut à la connexion régulatrice
- [ ] **COCK-02** : Time to Interactive cockpit **< 2 secondes** (mesuré Playwright)
- [ ] **COCK-03** : Mises à jour temps réel via Supabase Realtime, fade-in subtil (jamais de flash ni reload)
- [ ] **COCK-04** : Bloc « courses du jour » avec statut chauffeur, patient, statut course
- [ ] **COCK-05** : Bloc « alertes » (retards, imprévus, SMS échoués) en temps réel
- [ ] **COCK-06** : Tests d'intégration sur composant critique (cf. DEC-013)

### Planning Gantt (PLAN)

- [ ] **PLAN-01** : Vue planning Gantt par chauffeur et par jour
- [ ] **PLAN-02** : Drag-and-drop d'une course d'un chauffeur à un autre (réaffectation)
- [ ] **PLAN-03** : Visualisation des courses mutualisées et des temps morts
- [ ] **PLAN-04** : Réaffectations journalisées dans `audit_logs`

### Imprévus (IMPV)

- [ ] **IMPV-01** : Workflow « patient absent » (signalement chauffeur → décision régulatrice)
- [ ] **IMPV-02** : Workflow « panne véhicule » (réaffectation course en cours, notification patient)
- [ ] **IMPV-03** : Workflow « réaffectation course » à un autre chauffeur, propagation temps réel
- [ ] **IMPV-04** : Tests E2E Playwright sur les 3 workflows imprévus (cf. DEC-013)

### Communication SMS patient (SMS)

- [ ] **SMS-01** : Envoi SMS sortant uniquement si consentement patient actif et horodaté (cf. DEC-008)
- [ ] **SMS-02** : Templates personnalisables (rappel veille, retard, annulation), personnalisation par patient
- [ ] **SMS-03** : Numéro expéditeur = numéro pro de la société
- [ ] **SMS-04** : Envoi via Twilio ou OVH SMS Pro (cf. DEC-003), via `packages/sms` uniquement
- [ ] **SMS-05** : Statut delivery + réponse patient archivés dans la fiche patient
- [ ] **SMS-06** : Préférence patient (SMS / appel / aucun) respectée systématiquement
- [ ] **SMS-07** : Envois SMS journalisés dans `audit_logs`

### PWA chauffeur (CHAUF)

- [x] **CHAUF-01** : Boutons d'action principale ≥ 56 px de hauteur, texte ≥ 18 px (cf. DEC-014)
- [x] **CHAUF-02** : Une action principale unique par écran, en bas, accessible au pouce
- [x] **CHAUF-03** : Maximum 3 informations simultanées sur l'écran « course en cours »
- [x] **CHAUF-04** : Confirmations critiques par swipe (évite clics accidentels)
- [ ] **CHAUF-05** : Mode hors-ligne fonctionnel : tournée, démarrage / clôture course, scan BT (sync différée)
- [ ] **CHAUF-06** : Indicateur explicite « hors-ligne » + nombre d'éléments en attente de sync
- [ ] **CHAUF-07** : Lecture vocale (TTS) du nom patient et adresse au démarrage de course
- [ ] **CHAUF-08** : Mode contraste élevé activable, police agrandie (+20 %)
- [ ] **CHAUF-09** : Confirmation d'action **< 1 s même en 3G** (cf. DEC-005)
- [ ] **CHAUF-10** : Indicateur batterie + connexion réseau visibles en permanence
- [ ] **CHAUF-11** : Géolocalisation capturée uniquement pendant le service (cf. DEC-009)
- [ ] **CHAUF-12** : Chauffeur ne voit QUE ses propres tournées (`driver_id = auth.uid()`)

### Optimisation des tournées (OPTI)

- [x] **OPTI-01** : Microservice Python OR-Tools (`services/optimizer`) calculant les tournées optimales
- [ ] **OPTI-02** : Client TS `packages/optimizer-client` typé, isolé du calcul
- [x] **OPTI-03** : Suggestion de mutualisation de courses (plusieurs patients dans le même véhicule)
- [x] **OPTI-04** : Suggestion de mutualisation temporelle (courses intercalées dans temps d'attente)
- [x] **OPTI-05** : Couverture tests pytest sur le service Python (cf. DEC-013)

### Routing GPS (ROUT)

- [ ] **ROUT-01** : OSRM auto-hébergé (`services/osrm`) pour calcul d'itinéraires
- [ ] **ROUT-02** : Cartes via MapLibre + tuiles OSM (cf. DEC-003)
- [ ] **ROUT-03** : Pas de dépendance à un service de routing tiers payant en V1

### Caisse et paiements directs (CAIS)

- [ ] **CAIS-01** : Encaissement direct (cash, CB, chèque) rattaché à une course ou un patient
- [ ] **CAIS-02** : Rapprochement caisse de fin de journée
- [ ] **CAIS-03** : Encaissements journalisés dans `audit_logs` (cf. DEC-010)

### Mode dégradé (DEGR)

- [ ] **DEGR-01** : Régulatrice peut continuer à consulter le planning si Supabase Realtime tombe
- [ ] **DEGR-02** : Chauffeur peut clore une course en cours hors-ligne, sync au retour réseau
- [ ] **DEGR-03** : Indicateur explicite « mode dégradé actif » à l'utilisateur

### DPA + RGPD compliance (DPA) — Phase 1.5 (Infra/légal)

- [ ] **DPA-01** : Registre des traitements (art. 30 RGPD) — table `data_processing_register` + UI admin avec export PDF
- [ ] **DPA-02** : DPA Supabase (Data Processing Agreement, art. 28 RGPD) signé et tracké en base avec date d'effet, version, auteur
- [ ] **DPA-03** : DPIA / PIA (Analyse d'Impact Protection des Données) pour traitement données santé documentée et révisable
- [ ] **DPA-04** : Portail patient — droits art. 15 (accès), art. 16 (rectification), art. 17 (effacement), art. 20 (portabilité) accessibles depuis lien email patient
- [ ] **DPA-05** : DPO contact publié + procédure violation 72h CNIL documentée + tracker incidents
- [ ] **DPA-06** : Mention CGU / CGV opposables + bandeau cookies conforme CNIL (consent par finalité)
- [ ] **DPA-07** : Politique de confidentialité publique versionnée
- [ ] **DPA-08** : Tests d'export complet d'un patient au format JSON (portabilité art. 20)

### Visible Progress (VIS) — Phase 0.7 (Infra transverse, débloque tout)

- [ ] **VIS-01** : Vercel project connecté au repo + chaque PR déclenche un déploiement preview avec URL stable affichée dans la PR (commentaire bot Vercel)
- [ ] **VIS-02** : Environnement Supabase staging (projet distinct de dev) connecté à Vercel preview via env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_NIR_*`, `APP_LEGAL_TOKEN_SECRET`)
- [ ] **VIS-03** : Seed démo 974 (`supabase/seed.demo.sql`) — 3 sociétés fictives, 6 chauffeurs, 30 patients (noms réunionnais, NIRs valides Luhn, adresses Saint-Denis/Saint-Pierre/Le Tampon), 50 prescriptions, 200 courses passées
- [ ] **VIS-04** : 3 comptes démo seedés (`dirigeant@demo.tap.re`, `regulateur@demo.tap.re`, `chauffeur@demo.tap.re`, mot de passe `demo1234!`) affichés en bas de `/login` UNIQUEMENT en preview/staging (env var `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true`)
- [ ] **VIS-05** : Dossier `docs/showcase/` avec convention `{phase-num}-{slug}/` + smoke test Playwright `tests/smoke/preview.spec.ts` (login démo régulateur → cockpit s'affiche → /patients liste 30 patients seedés)

### Bootstrap OSRM (OSRM-bootstrap) — Phase 4.5 (Infra)

- [ ] **OSRM-bootstrap-01** : `services/osrm` Docker container démarrable en local et en CI
- [ ] **OSRM-bootstrap-02** : Tuiles OSM Réunion (974) préparées et chargées au démarrage
- [ ] **OSRM-bootstrap-03** : Wrapper TS typé `packages/osrm-client` exposant `route(origin, destination)` retournant distance + ETA en < 50 ms (mesuré CI)

### Géolocalisation temps réel (GEO) — Phase 9.5

- [ ] **GEO-01** : Capture position chauffeur via PWA pendant le service uniquement (DEC-009 — toggle ON au login, OFF déconnexion)
- [ ] **GEO-02** : Streaming Realtime Supabase de `driver_location` au cockpit avec rafraîchissement < 5 s
- [ ] **GEO-03** : Rétention 90 jours en base chaude (`driver_location`), agrégation puis purge automatique au-delà
- [ ] **GEO-04** : Indicateur explicite « tracking actif » dans l'UI chauffeur en permanence

### KPIs dirigeant (KPI) — Phase 14

- [ ] **KPI-01** : CA mensuel par société et par donneur d'ordres avec comparatif M-1 et M-12
- [ ] **KPI-02** : Marge brute estimée par course (recettes − coûts directs : essence/km, salaire chauffeur estimé, péages)
- [ ] **KPI-03** : Taux de mutualisation (% courses mutualisées / total courses) calculé et affiché
- [ ] **KPI-04** : Productivité chauffeur (km parcourus, courses/jour, ratio temps roulé / temps service) par chauffeur
- [ ] **KPI-05** : Drill-down filtre par chauffeur, véhicule, donneur d'ordres avec remontée à la course individuelle
- [ ] **KPI-06** : Export PDF mensuel généré automatiquement et envoyé au dirigeant

### Conformité réglementaire (CONF) — Phase 15 (Infra/légal)

- [ ] **CONF-01** : Tables `driver_credential` + `vehicle_credential` avec colonne `expires_at` indexée
- [ ] **CONF-02** : Suivi credentials chauffeur (carte pro, certificat de capacité professionnelle, visite médicale) et véhicule (CT annuel pour TAP/VSL, agrément ARS pour VSL, convention CPAM pour taxi conventionné, assurance, RC pro)
- [ ] **CONF-03** : Alertes anticipées 90 jours / 60 jours / 30 jours par email + notification cockpit régulateur
- [ ] **CONF-04** : Blocage automatique de l'assignation course si carte pro chauffeur ou CT véhicule expiré (message clair en français)
- [ ] **CONF-05** : UI admin pour saisie / mise à jour idempotente des credentials avec entrée audit_logs
- [ ] **CONF-06** : Tests E2E couvrant le flow alerte 90j → renouvellement → débloquage assignation

### Exports comptables et intégrations (EXP) — Phase 16

- [ ] **EXP-01** : Export FEC (Fichier des Écritures Comptables) annuel au format DGFiP — .txt pipe-separated, ordre chronologique, colonnes imposées Livre des Procédures Fiscales — passe la validation FEC officielle (test-comptes.dgfip.finances.gouv.fr)
- [ ] **EXP-02** : Export Lomaco CSV mensuel au format propriétaire Lomaco (logiciel transport sanitaire) — testé en intégration avec un cabinet expert-comptable design partner
- [ ] **EXP-03** : PDF récapitulatif mensuel par société et par donneur d'ordres B2B
- [ ] **EXP-04** : Schedule mensuel automatique avec envoi email au DPO et à l'expert-comptable + accusé de réception
- [ ] **EXP-05** : Exports signés (hash SHA-256 + horodatage) pour traçabilité légale

### Beta terrain chauffeur (BETA) — Phase 17 (V1.5)

- [ ] **BETA-01** : 2-3 chauffeurs design partners recrutés dans les Hauts (Plaine des Cafres, Cilaos, Salazie) utilisant la PWA quotidiennement pendant ≥ 2 semaines
- [ ] **BETA-02** : Tests mode soleil (contraste élevé) en cockpit véhicule par 35 °C : taux d'erreur tactile mesuré et < 5 %
- [ ] **BETA-03** : Tests sync différée 3G dégradé sur les routes des Hauts : taux de drops sync mesuré et < 1 % avec recovery automatique
- [ ] **BETA-04** : Consommation batterie d'une tournée 8 h mesurée et < 30 % d'une charge full sur smartphone milieu de gamme
- [ ] **BETA-05** : Au moins 5 itérations PWA Phase 9 livrées suite aux retours terrain (V1.5.1, V1.5.2, ...)

---

## v2 Requirements

Reportés à une release ultérieure. Trackés mais non dans le roadmap V1.

### Portail B2B (B2B)

- **B2B-01** : Donneur d'ordres (hôpital, clinique, EHPAD) peut créer une demande de transport
- **B2B-02** : Grilles tarifaires B2B (`b2b_tariff_grid`) versionnées par client
- **B2B-03** : Facturation B2B mensuelle automatisée

### Litiges CGSS (LIT)

- **LIT-01** : Suivi des litiges (`ride_dispute`) avec statut, motif, pièces jointes
- **LIT-02** : Export du dossier de litige (PDF / CSV) pour la CGSS

### 15 modules secondaires CDC v2

À détailler après ingest du `.docx` converti en `.md`. Pointeurs dans le CDC v2 — modules non encore extraits dans le repo intel.

---

## Out of Scope

Exclus explicitement. Documenté pour éviter le scope creep.

| Feature | Raison |
|---------|--------|
| Application native iOS / Android chauffeur | PWA suffit ; native uniquement si limites techniques bloquantes prouvées |
| Multi-langue (anglais, créole, etc.) | Cible 974, FR uniquement à court terme |
| Analyse vidéo / dashcam intégrée | Hors périmètre métier |
| Module comptabilité complet | Caisse couvre les paiements directs ; compta = outil tiers |
| Outils marketing intégrés | Focus 100 % opérationnel |
| Application B2C patient (booking direct) | Non aligné avec le modèle conventionné CGSS |
| OAuth (Google, Apple, etc.) | Supabase Auth e-mail + 2FA optionnel suffit |
| Real-time chat patient ↔ chauffeur | SMS unidirectionnels (consentement) suffit |
| Stockage vidéo / photos sensibles | Tant que l'hébergement HDS n'est pas en place commercial |

---

## Traceability

Mapping requirement → phase. Mis à jour lors de la création du roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOND-01 | Phase 0 | Complete |
| FOND-02 | Phase 0 | Complete |
| FOND-03 | Phase 0 | Complete |
| FOND-04 | Phase 0 | Complete |
| FOND-05 | Phase 0 | Complete |
| FOND-06 | Phase 0 | Complete |
| FOND-07 | Phase 0 | Complete |
| FOND-08 | Phase 0 | Complete |
| PAT-01 | Phase 1 | Pending |
| PAT-02 | Phase 1 | Pending |
| PAT-03 | Phase 1 | Pending |
| PAT-04 | Phase 1 | Pending |
| PAT-05 | Phase 1 | Pending |
| PAT-06 | Phase 1 | Pending |
| PAT-07 | Phase 1 | Pending |
| SAIS-01 | Phase 2 | Pending |
| SAIS-02 | Phase 2 | Pending |
| SAIS-03 | Phase 2 | Pending |
| SAIS-04 | Phase 2 | Pending |
| SAIS-05 | Phase 2 | Pending |
| SAIS-06 | Phase 2 | Pending |
| SAIS-07 | Phase 03.1 | Complete |
| SAIS-08 | Phase 03.1 | Pending |
| SAIS-09 | Phase 03.1 | Pending |
| SAIS-10 | Phase 03.1 | Pending |
| PRIC-01 | Phase 3 | Pending |
| PRIC-02 | Phase 3 | Pending |
| PRIC-03 | Phase 3 | Pending |
| PRIC-04 | Phase 3 | Pending |
| RECU-01 | Phase 4 | Pending |
| RECU-02 | Phase 4 | Pending |
| RECU-03 | Phase 4 | Pending |
| RECU-04 | Phase 4 | Pending |
| RECU-05 | Phase 4 | Pending |
| RECU-06 | Phase 4 | Pending |
| COCK-01 | Phase 5 | Pending |
| COCK-02 | Phase 5 | Pending |
| COCK-03 | Phase 5 | Pending |
| COCK-04 | Phase 5 | Pending |
| COCK-05 | Phase 5 | Pending |
| COCK-06 | Phase 5 | Pending |
| PLAN-01 | Phase 6 | Pending |
| PLAN-02 | Phase 6 | Pending |
| PLAN-03 | Phase 6 | Pending |
| PLAN-04 | Phase 6 | Pending |
| IMPV-01 | Phase 7 | Pending |
| IMPV-02 | Phase 7 | Pending |
| IMPV-03 | Phase 7 | Pending |
| IMPV-04 | Phase 7 | Pending |
| SMS-01 | Phase 8 | Pending |
| SMS-02 | Phase 8 | Pending |
| SMS-03 | Phase 8 | Pending |
| SMS-04 | Phase 8 | Pending |
| SMS-05 | Phase 8 | Pending |
| SMS-06 | Phase 8 | Pending |
| SMS-07 | Phase 8 | Pending |
| CHAUF-01 | Phase 9 | Complete |
| CHAUF-02 | Phase 9 | Complete |
| CHAUF-03 | Phase 9 | Complete |
| CHAUF-04 | Phase 9 | Complete |
| CHAUF-05 | Phase 9 | Pending |
| CHAUF-06 | Phase 9 | Pending |
| CHAUF-07 | Phase 9 | Pending |
| CHAUF-08 | Phase 9 | Pending |
| CHAUF-09 | Phase 9 | Pending |
| CHAUF-10 | Phase 9 | Pending |
| CHAUF-11 | Phase 9 | Pending |
| CHAUF-12 | Phase 9 | Pending |
| OPTI-01 | Phase 06.7 | Complete |
| OPTI-02 | Phase 06.7 | Pending |
| OPTI-03 | Phase 06.7 | Complete |
| OPTI-04 | Phase 06.7 | Complete |
| OPTI-05 | Phase 06.7 | Complete |
| ROUT-01 | Phase 11 | Pending |
| ROUT-02 | Phase 11 | Pending |
| ROUT-03 | Phase 11 | Pending |
| CAIS-01 | Phase 12 | Pending |
| CAIS-02 | Phase 12 | Pending |
| CAIS-03 | Phase 12 | Pending |
| DEGR-01 | Phase 13 | Pending |
| DEGR-02 | Phase 13 | Pending |
| DEGR-03 | Phase 13 | Pending |

**Couverture :**
- Requirements V1 (hors fondations) : 67
- Fondations livrées : 8
- Total V1 : 75
- Mappés à des phases : 75
- Non mappés : 0 ✓

---
*Requirements définis : 2026-05-06*
*Dernière mise à jour : 2026-05-06 après ingest et création du roadmap initial*

---

## NFR (Non-Functional Requirements transverses)

> Source : ingest run 2026-05-12, manifest `.planning/intel/staged-manifest.yml`.
> Promotion des contraintes CON-015..CON-020 en NFR formels. S'appliquent
> à toutes les phases sans exception.

- [x] **NFR-001** : Neutralité absolue — aucun nom propre dans code,
  identifiants, schémas DB, commentaires, JSDoc, commits, descriptions PR,
  mockups, captures, pages produit, marketing, légales. Substitution par
  rôles fonctionnels (`dirigeant`, `régulateur`, `chauffeur`, `patient`,
  `design partner`). Exception : `seed.demo.sql` pour illustration. Source :
  `.planning/regle-neutralite-et-ton.md`. CON-015.
- [x] **NFR-002** : Ton sobre — pas d'émojis dans l'UI, le code, les
  commits, les docs. Pas de tutoiement amical, pas d'humour, pas
  d'encouragements gamifiés. Empty states factuels. Messages d'erreur
  reformulés FR (jamais le brut Supabase/Postgres). Source :
  `.planning/regle-neutralite-et-ton.md`. CON-016.
- [x] **NFR-003** : Spacing scale strict — Tailwind 4/8/12/16/24/32/48/64
  uniquement. Aucune valeur intermédiaire (interdits : `px-3`, `px-5`,
  `px-6`, `gap-10`, etc.). Si un écran a l'air vide ou serré, c'est le
  mauvais cran de l'échelle. Audit grep CI à mettre en place (Passe 4).
  Source : `.planning/pivot-e2e-v2-2026-05-11.md` § 2. CON-018.
- [x] **NFR-004** : Identité visuelle imposée — bleu primaire profond
  (`--primary`) + accent terracotta (`--accent`, à utiliser réellement),
  Inter avec `font-feature-settings: 'tnum'` partout où il y a des
  chiffres (téléphones, montants, dates, IDs), Lucide ligne fine sans
  mélange. Mode jour/nuit traités à parité (palette dédiée, pas
  d'inversion mécanique). Source :
  `.planning/pivot-e2e-v2-2026-05-11.md` § 2. CON-019.
- [x] **NFR-005** : États interactifs et animations standard — 5 états
  distincts par élément interactif (repos, survol, pressé, actif,
  désactivé), transitions 150 ms ease-out, focus clavier visible
  (anneau coloré + offset), skeleton screens > 500 ms (jamais de
  spinners), optimistic UI, Toast Sonner (jamais alert/popup natif).
  Source : `.planning/pivot-e2e-v2-2026-05-11.md` § 2. CON-020.
- [x] **NFR-006** : Double goal par passe E2E — chaque passe (1, 2, 3,
  4) a deux goals parallèles : fonctionnel (ce que l'utilisateur peut
  faire) + UX (à quoi ça ressemble et comment ça se sent). Aucun goal
  ne peut être validé sans l'autre. Validation de fin de passe :
  walkthrough joué seul + ratio captures publiables ≥ 1:1. Source :
  ADR-003 + `.planning/pivot-e2e-v2-2026-05-11.md`. CON-017.
