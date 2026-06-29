---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: "Phase 09.06 (chore — machine à états centralisée des courses) livrée localement. PR à ouvrir."
last_updated: "2026-06-13T20:00:00.000Z"
last_activity: Phase 09.06 (chore — machine à états centralisée des transitions de statut des courses ; 0 migration, 0 dépendance). Même classe de fragilité que B1/B2 : les transitions du cycle de vie (brouillon→validee→assignee→en_cours→terminee + branches d'annulation) étaient vérifiées EN DUR dans 8+ endroits (courses/conduite/météo/groupes/replanification/api driver) sans source unique ni test. D-01 ride-state-machine.ts (@tap/shared) : table déclarative RIDE_TRANSITIONS reconstituée FIDÈLEMENT du code (aucune transition inventée) + canTransition(from,to) pur + statusesAllowedTo(to) + ACTIVE_RIDE_STATUSES (déplacé de meteo) + RIDE_MODIFIABLE_STATUSES (= statusesAllowedTo('annulee_meteo') = {validee,assignee}) + isModifiableStatus. D-02 refacto : assign (canTransition→assignee), conduite+api-driver start/end (canTransition→en_cours/terminee), unassign (arête assignee→validee), cancel/edit/meteo/reassign/assignVehicle (RIDE_MODIFIABLE_STATUSES/isModifiableStatus) ; compare-and-set SQL (.eq('status'), DEC-168) CONSERVÉ — la machine fournit la règle pas l'atomicité ; groupes bulk .eq('status','brouillon') commentés (arêtes déclarées). D-03 31 tests (légales/illégales/terminaux/cohérence cancellationTargetsAreKnown+ACTIVE+MODIFIABLE). D-04 comportement INCHANGÉ. Tracé (registre §14) : annulee_chauffeur = enum SANS producteur (terminal) ; cancelRideForNoShowAction→annulee_patient non gardé (candidat durcissement) ; 6 littéraux ['validee','assignee'] restants = filtres de LECTURE (crons reminders, affichages, backfill géoloc), hors scope. Grep contrôle : plus aucun littéral de transition dupliqué hors machine (hors .eq atomicité). typecheck+lint(0 err)+build+test(170 shared dont 31 machine) verts. 0 migration, 0 dépendance. DEC-178 LOCKED. Phase 13.01 (mode dégradé régulateur ; 0 migration BDD, 0 dépendance). Dernier trou de 5.24 (CdG §5.24) : le mode dégradé chauffeur existait, pas le régulateur. Distinction de conception : régulateur LECTURE SEULE (pas d'écriture offline, pas de PendingMutation) → réutilise les MÉCANISMES (Dexie, listeners online/offline, SW) pas la sémantique d'écriture. D-01 store Dexie SÉPARÉ tap-regulateur-offline (zéro régression chauffeur), table planning_mirror (contacts patient_phone + driver_phone inclus, exigence CdG) + meta planning_synced_at. D-02 OfflineGate (cockpit) en ligne appelle getRegulateurPlanningMirrorAction (J+J+1, contacts, guard dirigeant/régulateur, RLS) → saveRegulateurMirror (remplace tout + horodate) au mount + retour réseau. D-03 péremption 4h STRICTE (isPlanningStale) : si now-synced_at>4h, planning MASQUÉ + message « non fiables, reconnectez-vous » (fraîcheur = sécurité métier). D-04 hors-ligne, DegradedPlanning remplace le cockpit (bandeau lecture seule, contacts tel: cliquables, aucune écriture). D-05 SW matcher NetworkFirst navigation /cockpit (cache regulateur-cockpit-pages) avant defaultCache, après /api/driver NetworkOnly → ne régresse ni /conduite ni le chauffeur. D-06 useOnline (navigator.onLine + listeners). RGPD : contacts en cache local vidés à la déconnexion (clearRegulateurMirror sur le bouton UserMenu) + masqués >4h ; scope org. Garde-fous : zéro écriture offline régulateur ; store/SW chauffeur intacts. typecheck+lint(0 err)+build(SW OK) verts. 0 migration BDD (cache navigateur), 0 dépendance. Complète 5.24. DEC-177 LOCKED. Phase 09.05 (chore — garde-fou CI synchro app↔trigger SQL ; 0 migration, test only). Le bug B2 (12.05) venait d'un couplage MANUEL : la liste des statuts annulés existe à deux endroits non liés — la constante TS RIDE_CANCELLED_STATUSES (@tap/shared) et l'array `cancelled` du trigger Postgres rides_prescription_counter ; un trigger SQL ne peut pas importer une constante TS → la seule garantie était « surveiller manuellement », ce qui a échoué. D-01 test vitest cancelled-statuses-sync.test.ts (packages/shared) : lit la migration la PLUS RÉCENTE définissant l'array (parcours décroissant des supabase/migrations/*.sql, repo-root résolu en remontant depuis import.meta.url — aucun nom hardcodé), extrait les valeurs (regex tolérante), asserte set(SQL) === set(RIDE_CANCELLED_STATUSES) ∪ {'brouillon'} avec message clair (manquant/en trop côté SQL + nom du fichier). D-03 échec EXPLICITE si array introuvable (pas de skip silencieux). D-02 couplage documenté (commentaire near la constante + en-tête du test). Vérifié : vert sur main (5 valeurs alignées) ; « test du test » = faux statut → ROUGE avec message + 20260613000004…, puis vert après retrait. Tourne dans ci.yml (pnpm test → turbo @tap/shared:test, 16 fichiers/139 tests). Transforme le point de vigilance manuel en échec de build. typecheck+lint(0 err)+build verts. 0 migration, 0 dépendance runtime. DEC-176 LOCKED. Phase 12.06 (fix B3 — cohérence ride_group lors d'une annulation météo ; 1 migration enum, 0 dépendance). Gravité faible (conteneur de suivi, pas une donnée de remboursement) : l'annulation en lot météo filtrait status in (validee,assignee) en IGNORANT ride_group_id → une demande groupée B2B acceptee dont toutes les courses passent annulee_meteo restait acceptee (groupe fantôme). D-01 migration enum 20260613000005 : add value if not exists 'annulee' à ride_group_status (distinct de refusee=refus régulation et acceptee=actif ; cause externe). D-02 reconcileWeatherGroups (anti-N+1) : ride_group_id distincts des courses annulées → UNE requête survivants (status in validee/assignee/en_cours/terminee) → groupes sans survivant passent annulee via UN update groupé .in('id',fullyCancelled).eq('status','acceptee') ; survie partielle → reste acceptee. D-03 best-effort try/catch, jamais de rollback de l'annulation. D-04 aucune map UI de statut groupe à étendre (seule la file en_attente est listée) → pas de nouvel effet de bord d'enum. Garde-fous : no-op si aucune course groupée ; .eq('status','acceptee') ne touche pas en_attente/refusee. typecheck+lint(0 err)+build verts. 1 migration enum, 0 dépendance. DEC-175 LOCKED. Clôt l'audit transversal des effets de bord météo (B1 12.04, B2 12.05, B3 12.06). Phase 12.05 (fix CRITIQUE — trigger prescription ignorait annulee_meteo ; 1 migration corrective, 0 dépendance). Le compteur idempotent des bons de transport (rides_prescription_counter, 20260612000006) listait les statuts annulés EN DUR sans annulee_meteo → une course liée à une prescription annulée pour météo restait CONSOMMATRICE → le trajet n'était pas rendu au patient (bon de 5 → 4 restants alors que le transport n'a pas eu lieu) = donnée de remboursement CGSS faussée + litige. Plus grave que 12.04 (affichage). D-01 migration corrective 20260613000004 : CREATE OR REPLACE FUNCTION, array cancelled aligné (ajout annulee_meteo) ; logique de delta (consumes_old/new, greatest(0,…)) INCHANGÉE → idempotence préservée ; trigger non recréé. D-02 recompute rétroactif set-based des prescriptions ayant des courses annulee_meteo via la définition canonique (consomme = course ni brouillon ni annulée) ; idempotent, no-op si aucune. D-03 couplage : array SQL DOIT rester synchronisé avec RIDE_CANCELLED_STATUSES (@tap/shared) — SQL ne peut importer la constante TS → ajout aux DEUX endroits (commentaire migration + registre §12). D-04 seul array annulé en SQL (l'index rides_execution = liste positive de statuts actifs, hors scope) ; brouillon conservé. Test pgTAP prescriptions_rls étendu (+2 → 16 : course consommatrice puis annulée météo → trajet rendu). Sémantique inchangée ; sites d'écriture non touchés. typecheck+lint(0 err)+build verts. 1 migration corrective, 0 dépendance. DEC-174 LOCKED. Phase 12.04 (fix — cohérence du statut annulee_meteo, effet de bord 12.01 ; 0 migration, 0 dépendance). La valeur d'enum annulee_meteo (ajoutée 12.01) manquait dans plusieurs énumérations en dur des statuts d'annulation → bug fonctionnel : le taux d'annulation du tableau de bord excluait les annulations météo (faux pendant un épisode cyclonique). D-01 source unique RIDE_CANCELLED_STATUSES (4 valeurs annulee_regulateur/patient/chauffeur/meteo) + type RideCancelledStatus dans @tap/shared (validators/ride.ts) — remède de fond. D-02 fonctionnel : queries-dashboard.ts (compte via la constante), export-rides.ts (filtre z.enum + label « Annulée (météo) »), conduite/_lib/queries.ts (union DriverRideStatus complétée). D-03 cosmétique : badges chauffeur ride-card/ride-detail (couleur destructive), label régulateur ride-badges.tsx, PDF recap chauffeurs+donneurs (« Annulée (météo) »). D-04 : brouillon géré ; setup-sql.ts = snapshot Phase 0/1 frozen (hors scope, canonical = migrations). Sémantique inchangée ; sites d'écriture (groups/cockpit/cancel) non touchés. Grep de contrôle OK (annulee_regulateur + annulee_meteo ensemble partout). typecheck+lint(0 err)+build verts. 0 migration, 0 dépendance. DEC-173 LOCKED. Phase 12.03 (T2+T3 — accompagnant + mineur/référent légal, sans scan ; 3 migrations additives, 0 dépendance). US-REG-10. T2 accompagnant (CdG l.293) : colonnes rides.accompagnant/accompagnant_payant/accompagnant_identite, bloc de saisie, coût via la grille (tariff_grids.supplement_accompagnant_eur, moteur computeCgssFromDistance inchangé sauf terme additif soumis à majoration, champ optionnel dans TariffGrid → grilles B2B en dégradation gracieuse ?? 0). Règle CPAM « même taux que le patient » → supplément paramétrable (pas de doublement présumé), à valider métier (tracé). Affiché PricingBreakdown + carte grille CGSS + formulaire grille ; recalc maintenance CGSS+B2B threade accompagnant_payant. Capacité véhicule (1 place) tracée (contrat optimizer non modifié). T3 mineur/tutelle (CdG l.139-140) : colonnes patients.referent_nom/lien/telephone/type (check parental|tutelle) + referent_document_url NULL (scan reporté HDS) ; statut mineur DÉRIVÉ de date_naissance (util pur isMinor @tap/shared, source unique, jamais stocké) ; avertissement NON bloquant à la saisie course si référent manquant (MinorReferentWarning, pattern bon expiré 07.06 ; statut lu serveur getPatientReferentStatusAction base patients non-NIR RLS). patients_safe NON modifiée (dépendance fonction search_patients select p.*) → référent lu en base. Formulaire patient : section Référent légal (create + edit prefill getPatientReferentFields). Tests Vitest : isMinor (8) + pricing accompagnant (3, 100 % branches maintenu = 18). typecheck+lint(0 err)+build verts. 3 migrations additives, 0 dépendance. Résout T2+T3 (sans scan). DEC-172 LOCKED. Phase 12.01 (T1 — mode alerte météo / cyclone, cœur ; 2 migrations, 0 dépendance). Trou V1 critique (CdG l.380-385, US-REG-09) : La Réunion subit chaque saison cyclonique des alertes suspendant l'activité transport ; aucun état météo global → annulations une par une. D-01 table dédiée weather_alerts (historique/audit, reprise J+1/J+2 future) ; un seul épisode actif/org (index unique partiel weather_alerts_one_active) ; RLS forcée (lecture same-org, écriture dirigeant/régulateur, pas de DELETE). D-02 setWeatherAlertAction + bandeau cockpit « Mode alerte météo actif ». D-03 statut ride_status = annulee_meteo (migration séparée additive ; distinct annulation régulateur, stats/non-facturation). D-04 cancelRidesBatchWeatherAction({date, zone?}) : UPDATE compare-and-set (.in validee/assignee seules), bornes jour, filtre zone ilike pickup_city, cancel_motif. D-05 SMS annulation_meteo (≤160) best-effort post-commit via notifyWeatherCancellation (clone socle 09.03/10.02 : getActiveSmsConsentMap anti-N+1, consentement RGPD, trace sms_messages, service-role) — recontact annoncé, pas d'horaire de report inventé. D-06 push chauffeurs groupé (socle 06.69). D-07 replanif J+1/J+2 hors scope (tracée registre). Route /meteo (régulateur, nav « Météo »). Tests pgTAP weather_alerts_rls.sql (12). typecheck+lint(0 err)+build verts (/meteo présent). 2 migrations, 0 dépendance. Résout T1 (cœur). DEC-170 LOCKED.
last_activity_prev: Phase 13.01 mode dégradé régulateur (DEC-177). Phase 09.05 garde-fou CI synchro app↔trigger SQL (DEC-176).
# Comptage des phases (recompté 2026-06-08) : la roadmap est vivante, le dénominateur
# fixe historique « 38 » est obsolète. completed_phases = identifiants de phase numérotés
# marqués [x] dans ROADMAP — socle produit+technique (30) + phases individuelles livrées
# ensuite (06.20-06.23 pré-prod + 06.24-06.39 = 50) + 06.41 messagerie + 06.42 fix overlays
# + 06.43 fix cible cliquable + 06.44 refonte login + 06.45 login centré + 06.46 fix focus ring
# + 06.47 calibrage focus + 06.48 bouton auth aligné + 06.49 dashboard densité + 06.50 conformité
# densité + 06.51 form patient patron + 06.52 form véhicule/chauffeur + 06.53 patron de liste
# + 06.54 form spécialisés + 06.55 chauffeur mobile + 06.57 optimisation alignement
# + 06.58 drivers-list patron+découpe + 06.59 listes courtes legal+tarifs + 06.60 drawers+checkbox
# + 06.61 brouillons cockpit + 06.62 échafaudage messagerie + 06.63 échafaudage upload docs
# + 06.64 échafaudage email + 06.65 harmonisation checkbox + 06.66 primitive tooltip
# + 07.01 module donneurs d'ordres B2B (cœur) + 06.68 page Réglages + préférences
# alertes cockpit + 08.01 perf parallélisation fetchs + 08.03 perf data-cache org
# (pilote chauffeurs ; 08.02 absorbée = constat DEC-151, non compté)
# + 08.04 perf extension data-cache (vehicules/donneurs-ordres/tarifs)
# + 09.01 dette retrait as never (typage Supabase restauré)
# + 09.02 dette fin typage .from() (payloads non typables = constat)
# + 09.03 perf/fiabilité N+1 crons SMS
# + 07.02 grille tarifaire B2B (extension donneurs d'ordres 1/3)
# + 07.03 demande groupée B2B (extension donneurs d'ordres 2/3)
# + 07.04 récap PDF périodique B2B (extension donneurs d'ordres 3/3)
# + 10.01 replanification dynamique cœur (panne/indispo + réaffectation scorée)
# + 10.02 SMS patients impactés lors d'une réaffectation (complément replanification)
# + 07.05 référentiel prescripteurs (CdG §5.4, préalable des prescriptions)
# + 07.06 prescriptions/bons de transport (compteur + alertes, sans scan)
# + 07.07 KPIs prescriptions (top prescripteurs + bons par statut)
# + 07.08 tops commerciaux dirigeant (top patients CA + top donneurs B2B)
# + 07.09 KPI panier moyen par course
# + 06.69 notifications push PWA chauffeur (trou V1, sans HDS) = 94. (06.40
# hygiène docs ET 06.56 onboarding méthode = lots documentaires, hors compte feature ; 06.45 supersede
# 06.44 mais les 2 ont été livrées ; DEC-142 fix DialogContent = fix hors numéro de phase ;
# 06.67 chore CI = lot hors compte feature, comme 06.40/06.56 ; 09.04 fix concurrence
# anti-TOCTOU = fix de durcissement, hors compte feature comme DEC-142.) Restantes
# réelles = Phase 09 (HDS) + Phase 10 (géoloc réelle) = 2. Phase 07 mobile native abandonnée
# (DEC-092) hors compte ; 07.01 = module métier B2B et 09.01 = lot dette typage (sans rapport
# avec la Phase 09 HDS majeure à venir ; 09.02/09.03 = mêmes lots dette/perf). 10.01 =
# replanification dynamique cœur (item V1.5 §11.3), distinct de la Phase 10 géoloc réelle HDS.
# + 11.01 conformité détour transport partagé décret 2025-202 (T5) = 95 features.
# + 12.01 mode alerte météo / cyclone (T1, cœur) = 96 features.
# + 12.03 accompagnant + mineur/référent légal (T2+T3, sans scan) = 97 features.
# + 12.04 fix cohérence annulee_meteo = fix de durcissement, hors compte feature (comme DEC-142 / 09.04).
# + 12.05 fix CRITIQUE trigger prescription annulee_meteo = fix de durcissement, hors compte feature.
# + 12.06 fix B3 cohérence ride_group annulation météo = fix de durcissement, hors compte feature.
# + 09.05 garde-fou CI synchro statuts annulés app↔SQL = chore qualité, hors compte feature.
# + 13.01 mode dégradé régulateur (consultation hors-ligne planning J/J+1) = 98 features.
# + 09.06 machine à états centralisée des courses = chore qualité, hors compte feature.
# Dernière phase livrée : 09.06 (machine à états courses). Dernier DEC : 178 (09.06). Dernier ADR : ADR-013 (06.33).
progress:
  total_phases: 100
  completed_phases: 98
  total_plans: 104
  completed_plans: 104
  percent: 98
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06) + .planning/VISION.md (créé 2026-05-14)

**Core value:** La régulatrice doit avoir envie d'utiliser l'outil 8 h/jour, 220 j/an, sans jamais le subir.
**Current focus:** Phase 09.06 (chore — machine à états centralisée des courses) livrée localement. Les transitions du cycle de vie (assignation, démarrage, clôture, annulations, groupes, replanification) sont désormais dérivées d'une table unique `RIDE_TRANSITIONS` + `canTransition` testée dans `@tap/shared`, au lieu d'être vérifiées en dur dans 8+ fichiers. Comportement inchangé (reconstitué du code), compare-and-set SQL conservé, 31 tests. Même prévention que B1/B2 appliquée au cycle de vie. **GATE 08.x toujours en attente** : test isolation 2-orgs data-cache sur preview. 97 phases feature livrées + 4 lots hors compte (06.40 hygiène, 06.56 méthode, 06.67 chore CI, 09.04 fix concurrence) (cf. commentaire de comptage dans le frontmatter). **Tous les trous V1 issus des user stories sont traités** sauf T4 2FA (mis de côté par décision). 4 release toggles OFF pré-infra : GEOLOC, MESSAGING, UPLOAD_DOCS, EMAIL. **VAPID = secrets à générer** (npx web-push generate-vapid-keys → Vercel) pour activer le push en prod. Restantes : KPIs 5.20 restants (registre §9.4 — écart prévu/réalisé [préalable CA prévisionnel], récurrentes/ponctuelles [préalable activer rides.ride_recurrence_id], KPIs économiques marge/coût km paramétrables, occupation/productivité, litiges) ; lots suivants replanification (registre §8) ; lot alignement versions Supabase (débloque le typage des écritures, DEC-155) ; Lot 3 Suspense (différé) ; Phase 09 HDS (registre §1.1/§4.3 — débloque le scan des bons + précision géoloc replanification) + Phase 10 géoloc réelle ; choix provider email (registre §1.2) ; messagerie complète (registre §1.4 — réutilisera l'infra push) ; contacts donneurs multiples (registre §6.4) + portail self-service V1.5 (§6.5) ; étapes restantes du plan d'audit.

## Current Position

**Dernière mise à jour** : 2026-06-04 (cadrage Phase 06.14 lancé)
**Phase courante** : Phase 06.18 « Page de connexion — champs + UI aux normes » livrée localement (cadrage + exécution dans une seule PR). Entrée ROADMAP posée [ ]. Sync STATE après merge.
**Optimizer status** : `OPTIMIZER_USE_MOCK=true` en production et preview (décision dirigeant 2026-06-03). Le mock produit des groupements 2-par-2 cohérents avec le contrat zod, l'enrichissement Wave 4 fonctionne (libellés véhicules, adresses lisibles). Réactivation vrai solveur reportée à Phase 06.12 candidate (renumérotée depuis 06.11, cf. DEC-085).
**Géocodage** : pipeline UI→DB fonctionnel depuis Phase 04.7 (DEC-044), scellé par tests Vitest PR #211. Les courses créées via UI avec sélection BAN/Géoplateforme persistent leurs 6 colonnes lat/lng/citycode.

Phase: 09.06 (chore — machine à états centralisée des courses) livrée localement (2026-06-12). PR à ouvrir.
Phase next: valider métier la règle de tarif accompagnant (supplément paramétrable vs doublement « même taux ») ; extension accompagnant grille B2B (`ordering_party_tariff_grids`, registre §11) ; prise en compte de la place accompagnant au solveur (capacité, registre §11) ; scans autorisation parentale / jugement tutelle (dépend HDS, registre §11) ; extension replanification météo J+1/J+2 (socle 10.01) ; T4 2FA dirigeant/régulateur (mis de côté) ; générer les clés VAPID (secrets Vercel) pour le push prod (06.69) ; rebrancher le détour réglementaire sur le routing réel (registre §4.2, post-HDS) ; KPIs 5.20 restants (registre §9.4) ; lots suivants replanification (registre §8) ; lot alignement versions Supabase (typage écritures, DEC-155) ; valider l'isolation 2-orgs data-cache sur preview (08.x) ; Lot 3 Suspense (différé) ; choix provider email (registre §1.2) ; messagerie complète (registre §1.4) ; contacts donneurs multiples (§6.4) ; portail self-service V1.5 (§6.5) ; Phase 09 HDS ; Phase 10 géoloc.
Status: 98 phases feature + 9 lots hors compte (06.40, 06.56, 06.67, 09.04, 12.04, 12.05, 12.06, 09.05, 09.06). Mode dégradé 5.24 COMPLET (chauffeur + régulateur 13.01). Série qualité « source unique testée » : statuts annulés (09.05), cycle de vie courses (09.06 machine à états). Audit effets de bord annulee_meteo clos (B1/B2/B3). Tous trous V1 traités sauf T4 2FA. Restants = chantiers à préalable (KPIs économiques/opérationnels) + blocages business (HDS, email, Lomaco). Data-cache référentiels 5/6 (gate preview en attente). 4 release toggles OFF pré-infra.
Blockers: 2 en attente — (1) GATE isolation 2-orgs data-cache (08.x) sur preview ; (2) typage des payloads d'écriture = never (skew @supabase/ssr/postgrest-js) → lot d'alignement de versions (hors 0-dépendance).
Last activity: Phase 09.06 (chore machine à états centralisée des courses). Transitions du cycle de vie vérifiées en dur dans 8+ endroits (même fragilité que B1/B2). D-01 ride-state-machine.ts (@tap/shared) : RIDE_TRANSITIONS (reconstituée du code, rien d'inventé) + canTransition pur + statusesAllowedTo + ACTIVE_RIDE_STATUSES (déplacé de meteo) + RIDE_MODIFIABLE_STATUSES + isModifiableStatus. D-02 refacto assign/unassign/conduite+api start-end/cancel/edit/meteo/reassign/assignVehicle ; compare-and-set SQL conservé (DEC-168) ; groupes bulk commentés. D-03 31 tests. D-04 comportement inchangé. Tracé : annulee_chauffeur sans producteur, no-show cancel non gardé, 6 filtres de lecture hors scope (registre §14). Grep contrôle OK. typecheck+lint(0 err)+build+test verts. 0 migration, 0 dépendance. DEC-178 LOCKED. PR à ouvrir.
Précédent: 13.01 mode dégradé régulateur (DEC-177), 09.05 garde-fou CI synchro app↔trigger SQL (DEC-176), 12.06 fix B3 cohérence ride_group annulation météo (DEC-175).

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
