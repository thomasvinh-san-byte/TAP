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

**État au 2026-06-04 : 30 phases livrées (produit + technique complets).** Reste : durcissement technique pré-prod (Sentry, tests RLS, error boundaries) + HDS (Phase 09, verrou production) + géoloc réelle (Phase 10, post-HDS). Décision business pendante : viser le 1er client payant.

## Phases

**Note sur la numérotation.** La numérotation reflète l'historique des insertions/renumérotations (ADR-003) et n'est pas séquentielle (« 06.9 » après « 06.19 », décimales multiples, « ex-Phase X »). L'ordre d'exécution réel est donné par les sections ci-dessous, pas par les numéros. Les n° des phases livrées sont conservés tels quels pour ne pas casser les références (PR / DEC / commits).

### ✅ Livré (30 phases — bloc produit + technique complet)

Liste GROUPÉE par domaine. Détail complet de chaque phase conservé dans la section « Phase Details » plus bas.

- [x] **Fondations & patients** (5 phases) — `0` monorepo + RLS multi-tenant + CI/CD ; `0.7` déploiement continu Vercel + démo seedée 974 ; `1` référentiel patients + NIR chiffré ; `1.5` DPA + RGPD (registre / DPA / DPIA / portail droits) ; `2` saisie express course (< 30 s, raccourci `Cmd/Ctrl+Shift+K`, brouillons).
- [x] **Passes E2E métier** (10 phases) — `03` squelette E2E Passe 1 (chauffeurs/véhicules/assignation/exécution/tarif/encaissement) ; `03.1` efficience modal course ; `03.2` série hotfixes finition ; `04` onboarding chauffeur + AuthShell ; `04.5` robustesse régulateur ; `04.7` pricing mockup + caisse Stripe-Balance + migration géocoding ; `04.9` PWA chauffeur enveloppe (Serwist + Dexie) ; `05` Passe 3 récurrences + cockpit Realtime + SMS + patient absent ; `05.5` tarif CGSS réel + grille admin + simulateur ; `06` Passe 4 resserrée (facturation CGSS PDF + audit RLS 28 tables + 38 Server Actions + dettes CI).
- [x] **Optimisation tournées** (3 phases) — `06.7` OR-Tools optimisation tournées + cockpit `/cockpit/optimisation` (mock pour démo) ; `06.10` dettes techniques 06.7 (hébergement Python épuisé) ; `06.12` solveur d'optimisation = heuristique TypeScript native ; **OR-Tools / Python / mock supprimés (ADR-010 supersede ADR-008+009)**.
- [x] **Espace dirigeant & conformité légale** (2 phases) — `06.6` conformité assistée (pré-remplissage RGPD : registre, DPA, DPIA) ; `06.8` tableau de bord dirigeant (CA mensuel, courses à facturer, KPIs, alertes).
- [x] **Design system & qualité saisie** (7 phases) — `06.11` polish produit (tableau enrichi + UX optimisation) ; `06.13` foundations design system (doctrine WCAG + RGAA + tokens DTCG) ; `06.14` migration tokens.json → Tailwind config (Style Dictionary, dark généré) ; `06.15` composant `<DataTable>` commun (13 tables) ; `06.16` `<PageHeader>` admin commun (16 pages) ; `06.17` conformité 132 champs (Field + NumberField + Combobox W3C APG) ; `06.18` page de connexion aux normes (PasswordInput + ThemeToggle + AuthShell RSC).
- [x] **Géocodage** (1 phase) — `06.19` branchement géocodage récurrences + filet serveur BAN (alimente solveLocal sur le segment dialyse).
- [x] **Modernisation stack** (1 phase) — `06.9` Next.js 14.2 → 15.5 (async APIs complètes, `typedRoutes` stable, MapLibre/PMTiles préparés).
- [x] **Géoloc prototype** (1 phase) — `10.0` prototype géoloc terrain + UI/UX cockpit (MapLibre + PMTiles, capture événementielle, données fictives, flag `GEOLOC_ENABLED` OFF en pré-HDS, banner consentement chauffeur).
- [x] **Incarnation Régulation lot 1** (1 phase) — `06.24` (livré #248 + reprise 2026-06-05) PageHeader unifié sur **9 écrans (app)** — 0 h1 manuel restant — + hiérarchie typographique travaillée par TAILLE en plus de la graisse/casse (`text-base` 8→**15** +88 %, `text-xs` 87→**73** -16 % sur le corps de texte). Convention titre-de-section harmonisée (`text-xs font-semibold uppercase tracking-wide` partout). Tables denses préservées. Premier lot d'incarnation de DEC-101.
- [x] **Incarnation Régulation lot 2** (1 phase) — `06.25` (livré 2026-06-05) couleur signature terracotta activée sur les **5 CTA moments-clés** du cœur métier (Nouvelle course, Créer course patient, Lancer le calcul, Valider l'ajustement, Marquer encaissé). Token accent corrigé `hsl(14 78% 55%)` → **`hsl(14 78% 46%)`** jour ET nuit pour passer WCAG AA texte normal sur blanc (contraste 4.61:1 jour / 6.33:1 nuit). Variant Button « accent » exposé via cva. Secondaire reste neutre/bleu : rare = fort (DEC-101 §3). DEC-104 LOCKED.
- [x] **Incarnation Régulation lot 3** (1 phase) — `06.26` (livré 2026-06-05) perception de vitesse : `loading.tsx` ajoutés aux **5 écrans à fetch** restants (cockpit, courses, courses/caisse, patients, patients/[id]) épousant le layout réel de chaque page (pas spinner générique). **7/7 écrans à fetch régulation** ont désormais un état de chargement. Empty states ton harmonisé (courses, caisse) ; cockpit empty laissé sans action (remplissage realtime, §4). `prefers-reduced-motion` couvert par la règle globale `globals.css`. DEC-105 LOCKED.
- [x] **Incarnation Régulation lot 4** (1 phase) — `06.27` (livré 2026-06-05) refactor structurel + cohérence modales. `ride-express-form-fields.client.tsx` (**493 l.** > CON-008) scindé en **5 modules** sous `courses/_components/ride-fields/` (types, datetime-helpers, masked-inputs, datetime-fields, field-groups + barrel) — tous **≤ 175 l.**, API publique préservée, 2 imports consommateurs mis à jour, **comportement inchangé** (129/129 tests passent sans modification). Revue cohérence modales courses : Dialog (focalisé) vs Sheet (contextuel) documenté en 1 ligne ; terracotta posé sur « Créer la course » + « Assigner » (cohérence lot 2). Incarne direction §5bis (structure code = structure visuelle). DEC-106 LOCKED.
- [x] **Incarnation Régulation lot 5 — rangement** (décision, pas de code) — audité 2026-06-05, **DEC-107 LOCKED**. Conclusion : le rangement est cohérent en pratique (nav unifiée par rôle, surlignage correct via « plus long préfixe gagne », accès régulateur à `/admin/chauffeurs` légitime). Les impuretés d'URL (caisse enfant de courses ; chauffeurs sous `/admin`) sont SANS impact utilisateur observable. Déplacement physique des URLs VOLONTAIREMENT NON RÉALISÉ : coût (18 + 7 refs + redirections + mémoire musculaire) > bénéfice (cosmétique). Direction §5ter respectée. Question close, réévaluable si vrai besoin émerge (SEO, refonte IA). **Programme d'incarnation Régulation DEC-101 désormais COMPLET (5/5).**
- [x] **Incarnation Chauffeur — terrain** (1 phase) — `06.28` (livré 2026-06-05) déclinaison « grande et lisible » de DEC-101 sur la famille driver (DEC-014). **Terracotta** sur « Démarrer la course » (cohérence lot 2 ; « Clôturer » reste `bg-warning` = sémantique d'attention de fin). **En-tête harmonisé** : `/conduite` migré vers `<PageHeader>`, empty state accueillant (« Pas de course pour l'instant ») avec titre `text-2xl` + description `text-base`. **Mode contraste élevé** (le vrai manque terrain) : hook `useHighContrast` + `<HighContrastToggle>` dans le header driver + CSS overrides via `[data-driver-contrast="high"]` ET `@media (prefers-contrast: more)` (auto-detect OS) ; persistance localStorage, 0 hex en dur. Cibles ≥ 56px, offline-first, tint crème préservés. DEC-108 LOCKED.
- [x] **Typographie française — chasse aux cadratins** (1 phase, finition transversale) — `06.29` (livré 2026-06-05) correction typographique transversale : **~50 incises en tiret cadratin (—) en prose d'UI visible** remplacées par la ponctuation française idiomatique selon le **sens** de chaque phrase (deux-points pour explicitation, point pour idées autonomes, virgule pour apposition courte, parenthèses pour aparté, **point médian `·`** pour titres/labels-séparateurs). Familles touchées : `(driver)`, `(app)` (patients/cockpit/courses), `(admin)` (legal/facturation/tarifs/sms-templates), `(auth)`, `components/`, optimizer route, server actions errors (batch `refusé(e) — droits insuffisants` → `:`). **20 séparateurs-vide `'—'` préservés** (convention « valeur absente »). Commentaires de code hors périmètre. 0 changement de sens. DEC-109 LOCKED.
- [x] **Incarnation Admin** (1 phase) — `06.30` (livré 2026-06-05) déclinaison de DEC-101 sur la famille admin (16 écrans, déjà la plus cohérente avec PageHeader partout). **Terracotta** sur 13 moments-clés (8 CTA page-level : Nouveau chauffeur, Inviter EmptyState, Nouveau véhicule, Ajouter EmptyState, Nouveau DPA, Nouvelle entrée registre, Nouvelle demande RGPD, Créer trame DPIA ; 5 submits drawer/sheet : Créer la version tarifs, Enregistrer registre/DPA, Créer requests, Envoyer l'invitation). **ARCHIVER reste destructive**, Modifier/Pré-remplir/Exporter restent neutres. **Extension légère `EmptyState`** : prop `variant?: 'default' | 'accent'` sur action (rétro-compat). **6 `loading.tsx`** (chauffeurs, vehicules, tarifs, facturation, legal/registre, legal/requests) épousant le layout réel. **Hiérarchie typo travaillée** : `text-base` 4 → **10** (+150 %), `text-xs` 25 → **21** (-16 %) ; prose légale promue à `text-base` (DPA/DPIA/registre prefill explanatory paragraphs) ; titres section maintenance et cards légal à `text-base` ; tables denses préservées. Cohérence légale (8 pages) vérifiée. DEC-110 LOCKED.
- [x] **Composant SegmentedControl** (1 phase, finition design system) — `06.31` (livré 2026-06-05) `<SegmentedControl>` + `<SegmentedNav>` factorisés dans `components/ui/segmented-control.tsx` (126 LOC < 150). Remplace le **toggle Actifs/Archivés daté** (conteneur `p-2` trop serré, différenciation par ombre seule, pas de poids typo, pas de transition) **dupliqué à l'identique dans 3 écrans** (patients-list, drivers-list, assign-modal). **Style sobre Linear/iOS** : conteneur `bg-muted rounded-lg p-4 gap-4`, actif `bg-background + font-medium + shadow-sm`, inactif `text-muted-foreground` + hover, transition 150ms ease-out, focus ring `ring-offset-muted`. 0 hex en dur, tokens uniquement (jour+nuit OK), `prefers-reduced-motion` couvert. A11y `role="tablist"`/`role="tab"`/`aria-selected` préservée. Comportement strictement INCHANGÉ (129/129 tests passent sans modification). Doc design-system ajoutée (`docs/design-system/09-segmented-control.md`). DEC-110bis LOCKED.
- [x] **Incarnation Auth + Public** (1 phase, lot léger) — `06.32` (livré 2026-06-05) incarnation DEC-101 sur Auth + Public. **Lot très léger** : ces familles ont des grammaires dédiées appropriées (`<AuthShell>` pour auth, prose MDX pour pages légales, parcours patient RGPD) — pas de refonte. **Terracotta** sur **3 moments-clés** (peu nombreux) : « Se connecter » (login), « Activer mon compte » (accept-invite), « Confirmer l'anonymisation » (RGPD erasure — JUSTIFIÉ : acte attendu du patient pour exercer son droit, pas vigilance subie côté admin ; contexte d'avertissement `border-destructive/40 bg-destructive/5` préservé). **Lisibilité prose RGPD patient** promue `text-sm` → **`text-base`** (public non-technique, parcours request/[token], erasure, access). **AuthShell + pages MDX inchangés** (grammaires dédiées). **Annexe animation** : audit conclut que le système est DÉJÀ conforme (tokens motion + reduced-motion global) ; micro-durcissement `Skeleton` avec `motion-reduce:animate-none` local (auto-doc, redondance volontaire avec règle globale). DEC-111 LOCKED.
- [x] **Conformité réglementaire — Lot 1 fondation** (CdC §5.21) — `06.33` (livré 2026-06-08) premier lot du module métier Conformité réglementaire. **Table polymorphe `compliance_items`** (driver/vehicle/organization, 8 types `kind` CHECK, multi-tenant RLS forcée + pgTAP 10 cas, trigger audit, indexes alerte/lecture). **Validators + libellés FR centralisés** dans `@tap/shared` (`COMPLIANCE_KINDS`, `COMPLIANCE_LABELS`, `complianceItemUpsertSchema` zod). **Helper pur `complianceStatus`** (90/60/30/7 j, 14 tests Vitest) — statut **dérivé à l'affichage, jamais stocké**. **Saisie embarquée** dans `driver-form` + `vehicle-form` via `<ComplianceFieldset>` (mode édition, slots pré-définis par entité) + page **`/admin/conformite`** (vue consolidée par entité + section convention CGSS organisation) + entrée nav. **`<ComplianceBadge>`** sémantique (icône + texte + jours, WCAG 1.4.1 critère couleur seule) dans drivers-list + vehicles-list (colonne Conformité). **Distinct du `ComplianceCard` RGPD documentaire** (registre/DPA/DPIA). Server Actions DEC-041 (row-count check sur UPDATE). **Lot 2** (cron + alertes cockpit/email 90/60/30/7) et **lot 3** (blocage paramétrable planification) à venir. **Upload de scan** `document_url` différé tant qu'aucun bucket Storage HDS prêt. ADR-013 (table dédiée vs colonnes éparses) + DEC-112 LOCKED.
- [x] **Conformité réglementaire — Lot 2 alertes in-app** (CdC §5.21) — `06.34` (livré 2026-06-08) deuxième lot. **Cadrage GSD validé** : Q1 IN-APP uniquement (cockpit régulateur + dashboard dirigeant ; email/push REPOUSSÉ), Q2 DÉRIVÉ (statut/alerte calculés à la volée, pas de stockage, pas d'accusé de lecture), pas de cron au lot 2. **Helper pur `selectComplianceAlerts` + `countComplianceAlerts`** dans `@tap/shared` (9 tests Vitest verts) : filtre `soon`/`expired`, tri par urgence (expired le plus passé en haut, puis soon ascendant). **Query serveur `getComplianceAlerts`** (`'server-only'`) partagée cockpit + dashboard, hydrate labels d'entité applicativement. **`<ComplianceAlertsPanel>`** variants `panel` (cockpit aside, dense, limit 4, sous AlertsPanel courses — distinct) et `card` (dashboard, bordée, grid 2 cols à côté du `ComplianceCard` RGPD, limit 5). Statut accessible (icône + texte + jours, WCAG 1.4.1). Lien « Gérer les échéances » → `/admin/conformite`. **Pas de terracotta** (pas un moment-clé d'action). 0 migration BDD, 0 cron, 0 dépendance. Lot 3 (blocage paramétrable planification) à venir. DEC-113 LOCKED.
- [x] **Conformité réglementaire — Lot 3 contrôle planification** (CdC §5.21) — `06.35` (livré 2026-06-08) **dernier lot, module COMPLET**. **Cadrage GSD validé** : Q4 souple-par-défaut (avertissement, régulatrice garde la main) paramétrable vers dur ; Q5 optimiseur INCLUS (sinon contournement) ; Q6 granularité GLOBALE (réglage org unique). **Migration** `compliance_blocking_mode text default 'warn' check (warn|block)` sur `organizations`. **Helper pur `entityComplianceState` + `isPlanningBlocking`** (`@tap/shared`, **8 tests Vitest** verts). **Assign-modal** : badge « Non conforme » (icône + texte, WCAG 1.4.1) ; mode `warn` (panneau d'avertissement + toast warning au succès, submit OK) ; mode `block` (ligne désactivée + submit refusé client + **revérif serveur dans `assignRideAction`** — defense in depth). **Optimiseur (route `/api/optimizer`)** : warn = tous au solveur + signalement `complianceWarnings` ; block = véhicules non conformes filtrés du pool + `complianceWarnings.blocked=true`. UI `optimization-shell` affiche panneau dédié. Extension rétro-compatible `OptimizationProposal.complianceWarnings?` (`@tap/optimizer-client`). **`<BlockingModeControl>` SegmentedControl** dans `/admin/conformite` (dirigeant) + `updateComplianceBlockingModeAction` (DEC-041 row-count check). **Module Conformité §5.21 COMPLET (lots 1+2+3)**. DEC-114 LOCKED.
- [x] **Incarnation header / navigation** — `06.36` (livré 2026-06-08) angle mort des lots 06.24 → 06.32 comblé. Direction §3 (« bleu profond = la structure de confiance : navigation active, liens, en-têtes de section, identité ») appliquée au header global. **NavTabs** : onglet actif `text-foreground` → **`text-primary font-medium`** + soulignement 2px → **3px pleine opacité** (`rounded-t-sm`). Double signal (couleur + poids + soulignement, WCAG 1.4.1). **Logo « TAP »** en `text-primary text-base font-semibold` (présence de marque) ; « Régulation » reste muted. **`shadow-sm`** ajouté au header pour séparation contenu (sticky + backdrop-blur conservés). **Factorisation `<AppHeader>`** : les deux layouts (app + admin) passent de ~30 lignes de header dupliqué à 1 ligne (slot `extras` pour DraftQueue côté `(app)`). **Contraste WCAG vérifié** : `text-primary` jour 9.42:1 (AAA), nuit 5.21:1 (AA). **Header chauffeur PWA hors périmètre** (grammaire dédiée DEC-014). DEC-115 LOCKED.
- [x] **Exports courses CSV + statistiques + PDF récap chauffeur** (§5.23 partiel) — `06.37` (livré 2026-06-08) comble une partie du creux CdC §5.23 avec les **briques existantes** : zéro dépendance, zéro achat. **`exportRidesCsvAction`** (pattern caisse, zod period+filtres, guard admin/régulateur) + bouton « Exporter CSV » dans la toolbar `RidesList`. **`exportStatsCsvAction`** (réutilise `getDashboardData` — **0 duplication d'agrégat**, sections volume/incidents/chauffeurs/CA + comparatif N-1) + bouton dans le PageHeader du tableau de bord (dirigeant). **Route `/api/admin/chauffeurs/recap/pdf`** (runtime nodejs, `renderToStream`, `PdfDocument` + `PdfSection` + `pdfStyles` charte commune, guard dirigeant, **audit log AVANT** rendu) + `<RecapPdfButton>` (mini-dialog from/to) dans `DriverRowActions`. **Lomaco** (format externe) et **FEC normé** (à délibérer) **RESTENT REPOUSSÉS** (registre). 0 migration BDD, 0 nouvelle dépendance, 0 régression. RGPD minimisation respectée. DEC-116 LOCKED.
- [x] **Header — regroupement de la navigation dirigeant** — `06.38` (livré 2026-06-08) désencombrement du header dirigeant (recherche secteur : top-bar 5-7 max ; TAP dirigeant était à **11 entrées plates**). Décision : regroupement (pas sidebar — repoussée si besoin persiste). **Dirigeant** = **5 liens primaires** (Tableau de bord, Cockpit, Patients, Courses, Caisse — flux quotidien) + **3 menus déroulants** : **Flotte ▾** (Chauffeurs, Véhicules, Conformité, Maintenance), **Gestion ▾** (Tarifs, Facturation), **Légal ▾** inchangé. **Régulateur** conservé à 5 entrées plates (sous le seuil, son flux reste 1 clic). Pattern `LegalNavMenu` généralisé en **`<NavGroupMenu>`** (prop `group: NavGroup`). Signature bleue active **DEC-115 préservée** même dans un menu : `text-primary` sur le trigger + soulignement 3px quand un item est actif ; `aria-current="page"` sur trigger ET item. `nav-config` restructuré (`NavGroup`/`RoleNav`/`navForRole`) — source unique. **Pas de changement d'URL** (les 11 routes restent). WCAG/RGAA : `DropdownMenu` shadcn (clavier OK). 0 migration BDD, 0 dépendance, 0 régression. DEC-117 LOCKED.
- [x] **SegmentedControl — densité** — `06.39` (livré 2026-06-08) ajustement de densité du composant partagé `<SegmentedControl>`/`<SegmentedNav>` (recherche secteur : accorder la densité visuelle à l'UI environnante ; un contrôle taille mobile détonne dans un dashboard dense et entre en compétition avec les données ; ne PAS retirer le fond actif = anti-pattern a11y, surtout en sombre). **Cause réelle** : le segment portait `py-6`, qui retombe sur l'échelle Tailwind par défaut (24px) au lieu du scale custom — hauteur ~76px, ~le double du champ de recherche voisin (`Input` h-10 = 40px). **Correctif** : segment `py-6` → **`py-4`** (4px) → hauteur ~36px (h-9), alignée sur la barre de filtres (patients, chauffeurs). Conteneur `p-4`/`gap-4`, `rounded-lg`, **fond plein actif + `font-medium` + `shadow-sm` CONSERVÉS** (double signal fond+graisse, contraste ≥ 4.5:1 jour ET nuit). Transition ≤150ms + `prefers-reduced-motion` inchangés. Composant partagé → profite aux **3 usages** (patients, chauffeurs, assign-modal) + `BlockingModeControl`. Périmètre densité uniquement : pas de changement d'API, de logique, de couleur. 0 migration BDD, 0 dépendance, 0 régression. DEC-118 LOCKED.
- [x] **Hygiène — nettoyage `.planning` + resync tracking + docs de référence** — `06.40` (livré 2026-06-08) grand ménage planning/docs-only (0 code applicatif, 0 migration). **`git rm` de ~224 fichiers de processus consommé** sous `.planning/phases/` (PLAN/CONTEXT/SUMMARY/DISCUSSION-LOG/UI-SPEC/RESEARCH/UAT/VERIFICATION/STEPS des phases déjà livrées + mergées) — git garde l'historique, pas d'archivage parallèle. **`10.0-prototype-geoloc/` préservé** (seul fichier restant sous `phases/`). 3 `deferred-items.md` fusionnés dans le registre des travaux repoussés AVANT suppression (dette ESLint v10 flat config + test SIRET Luhn Carrefour). **STATE.md recompté** : compteur faux `34/38` corrigé → **50 phases livrées** (méthode de comptage documentée en commentaire frontmatter ; dénominateur fixe « 38 » obsolète, roadmap vivante). **Registre DEC de PROJECT.md réconcilié** avec ROADMAP : DEC-118/119 ajoutés + entrées concises 082→111 comblant les trous historiques (registre complet jusqu'à DEC-119). **6 docs de référence durables** créés/relocalisés : `registre-travaux-repousses.md` + `elements-disponibles.md` (racine) ; `cadrage-gsd-conformite.md` + `conformite-journal.md` (`modules/conformite/`) ; `cadrage-gsd-exports.md` (`modules/exports/`) ; `recherche-ui-header-controls.md` (`research/`). Prompts CC consommés non versés. `intel/` + `codebase/` + racine vivante intacts. DEC-119 LOCKED. Pas d'ADR.
- [x] **Messagerie interne — Lot 1 : chat texte temps réel à la course** (CdC §5.22) — `06.41` (livré 2026-06-08) premier lot (cœur) du module Messagerie, dérivé du cadrage GSD validé. Chat texte régulateur↔chauffeur **rattaché à une course**. **Table unique `internal_message(ride_id, organization_id, sender_profile_id, sender_role, body, created_at)`** — la course EST la conversation (pas de table conversation séparée → évite le bug Supabase #1721 de payloads Realtime mélangés). **RLS stricte forcée + indexée** : SELECT same_org (régul/dirigeant voient l'org ; chauffeur uniquement SES courses via `drivers.profile_id`) ; INSERT anti-usurpation (`sender_profile_id = auth.uid()`, `sender_role = current_user_role()`, chauffeur seulement sur ses courses) ; **messages immuables** (pas d'UPDATE/DELETE, ni policy ni grant). **Publication Realtime idempotente** (Postgres Changes, cohérent cockpit). **14 tests pgTAP** (cross-tenant, isolation par course/chauffeur, anti-usurpation profil+rôle, anon, grants). **Query server-only `getRideMessages`** + Server Actions `getRideMessagesAction`/`sendRideMessageAction` (guard auth + zod 1..2000) + **helper pur `groupMessagesByDay`** (fuseau Indian/Reunion, 8 tests Vitest). **Hook `useRideMessages`** (channel par course `internal_message:{rideId}`, filtre `ride_id=eq.`, reconnexion + refetch au resubscribe) + **composant `<RideChat>`** (aria-live, distinction d'auteur par libellé de rôle pas la couleur, Cmd/Ctrl+Entrée, auto-scroll `prefers-reduced-motion`, jour+nuit tokens). Greffé dans `ride-drawer` (régulateur) + `ride-detail` (chauffeur). **Photo (HDS), push web (VAPID), fil général, purge 1 an, email** : repoussés (registre / lots ultérieurs). 0 dépendance nouvelle (Realtime déjà là). DEC-120 LOCKED.
- [x] **Fix overlays — combobox portal + dialog scrollable** (correctif UI bloquant) — `06.42` (livré 2026-06-09) correction **cause-racine** de 2 bugs overlays de même famille (overlays mal détachés ; recherche : un élément `absolute` n'échappe pas au clipping/stacking d'un ancêtre — z-index ne corrige rien de fiable). **Bug 1** : la listbox du `<Combobox>` (Marque véhicule + adresses) se superposait au contenu. **Bug 2** : le modal « Nouvelle course » débordait, bouton « Créer » coupé. **D-01 Combobox** : listbox rendue via **`createPortal`** (react-dom, 0 install) au `document.body` + **position `fixed` ancrée** au rect du champ (recalcul scroll capture/resize, **flip haut/bas**), z-`[60]` au-dessus des dialogs (cas address-picker dans le modal) ; ARIA APG + clavier + Échap + clic-dehors **préservés** (`listboxRef` ajouté au check) ; `onPointerDown` stoppé pour ne pas fermer le `Dialog` Radix (DismissableLayer) ; 8 tests combobox **inchangés et verts**. **D-02 DialogContent** : `max-h-[85dvh]` + `overflow-y-auto` + `w-[calc(100%-2rem)]` + `min-w-0` sur les grilles `ride-fields` (mode/urgence + datetime) → formulaires longs scrollent, bouton de validation atteignable, pas de débordement horizontal. **Composants partagés** → propage à tous les usages. **Pas de `@radix-ui/react-popover` ni `floating-ui`** (DEC-003). 0 migration, 0 dépendance. DEC-121 LOCKED. Pas d'ADR.
- [x] **Fix cible cliquable — suppression brouillons (WCAG 44px)** (correctif a11y) — `06.43` (livré 2026-06-09) la corbeille du popover brouillons (`draft-queue`) faisait **~12px** de cible (icône `h-12` nue, sans padding ni min-size) → sous **WCAG 2.5.8** (≥24px minimum, 44px recommandé ; cibles <44px = taux d'erreur ×3). Patron **icône discrète + cible large** (recherche `recherche-touch-targets.md`). **D-01** : variant `size="icon"` du `<Button>` porté `h-10 w-10` (40px) → **`h-11 w-11` (44px)** (confort Apple/AAA, +4px marginal ; **0 régression** — aucun autre usage de `size="icon"` dans le code). **D-02** : la corbeille passe d'un `<button>` nu à **`<Button variant="ghost" size="icon">`** (cible 44px, **hover `bg-muted` + focus-visible ring** inclus) ; l'**icône reste discrète** `Trash2 h-16 w-16` (on agrandit la cible, pas le dessin) ; `aria-label` + `stopPropagation` conservés. **D-03** : `gap-8` dans la ligne meta (**≥8px** entre horodatage et corbeille). Suppression sans confirmation inchangée (hors périmètre). 0 migration, 0 dépendance. DEC-122 LOCKED. Pas d'ADR.
- [x] **Refonte page de connexion — bleu institutionnel** _(SUPERSEDED par 06.45 — split-screen abandonné au profit du formulaire centré)_ — `06.44` (livré 2026-06-09) la page login faisait peu pro (panneau gauche `bg-muted` terne, logo 12px tronqué, bouton terracotta criard). Recomposée en split-screen fidèle à la direction (recherche `recherche-page-login.md` + DEC-101 : bleu institutionnel = identité ; terracotta réservé aux moments-clés métier — un login n'en est pas un). **D-01** : bouton « Se connecter » `variant="accent"` (terracotta) → **`variant="default"`** (bleu primary). `accept-invite` **NON touché** (terracotta « Activer mon compte » = moment-clé justifié, LOCKED par DEC-111). **D-02** : `aside` `bg-muted` → **`bg-primary text-primary-foreground`** ; **marque rendue typographiquement** (pavé « T » + mot « TAP » colorés par tokens, lisibles ~40-48px — fini le logo 12px tronqué ; **pas de SVG figé** qui casserait en nuit) ; **baseline forte** + **3 points de valeur** sobres (`Check`, `/80`) ; footer `/70` ; bloc ancré (`justify-center`). **D-04** : responsive `< lg` = **bandeau compact** (points de valeur + footer masqués, baseline `text-xl`). Contraste **AA jour** (bleu profond/blanc) **ET nuit** (bleu clair/navy) garanti par la paire de tokens `primary`/`primary-foreground`. `Image` next/image retirée (inutilisée). **Composition typographique, aucun asset produit.** Artefact avant/après `docs/showcase/06.44-refonte-login/`. 0 migration, 0 dépendance. DEC-123 LOCKED. Pas d'ADR.
- [x] **Refonte login — formulaire centré** _(supersede 06.44)_ — `06.45` (livré 2026-06-09) le split-screen de 06.44 était hors-norme (ratio inversé ~75% branding / <25% form, panneau de marque léger à moitié vide). Recherche : le split vaut pour 2 éléments de **poids égal** (ratios 40:60/33:66) ; en-dessous d'1/3 « c'est une sidebar, pas un split ». Contenu de marque TAP léger → **formulaire CENTRÉ** (pattern Notion/Linear ; B2B = une colonne par défaut, chemin le plus court vers l'entrée). **D-01** : `AuthShell` split `lg:flex-row` → **layout centré une colonne** (`min-h-screen flex items-center justify-center`, fond `bg-muted` sobre) ; **panneau bleu pleine hauteur supprimé** ; `ThemeToggle` en coin haut-droite (clavier OK). **D-02** : **carte centrée** `max-w-[400px] bg-background rounded-lg border shadow-sm p-32` — en-tête marque (pavé « T » `h-32` + mot « TAP » par tokens, fini le `h-12` tronqué ; **pas de SVG figé** qui casserait en nuit sur carte sombre) + titre `{title}` ; `{children}` ; `rightSlot` (démo) + `footerHint` conservés ; **baseline courte sous la carte** ; **3 puces supprimées** (allègement). **D-03** bouton bleu : déjà fait en 06.44 (`variant="default"`). Footer page discret en bas. **Shell partagé** → profite à **/login ET /accept-invite**. API du composant (props) inchangée. Contraste **AA jour ET nuit** (tokens). **Aucun asset produit.** Artefact avant/après `docs/showcase/06.45-login-centre/`. 0 migration, 0 dépendance. DEC-124 LOCKED (supersede DEC-123). Pas d'ADR.
- [x] **Fix anneau de focus primary — faux soulignement** (correctif a11y, token) — `06.46` (livré 2026-06-09) les boutons à fond primary affichaient un faux soulignement/liseré au focus. **Cause racine** : `--ring` était **strictement égal** à `--primary` (jour `217 92% 32%`, nuit `217 91% 60%`) → l'anneau `focus-visible:ring-ring` dessiné sur un bouton `bg-primary` avait la même couleur que le fond, se fondait, et l'offset créait un trait perçu comme un soulignement de lien. Touche **tous** les boutons primary focalisés. **D-01** : `--ring` découplé de `--primary` à la **source** (`tokens.json` `focusRing` `217 92% 32%` → **`217 91% 60%`** ; `tokens.dark.json` `217 91% 60%` → **`213 94% 78%`**) puis régénération via `pnpm tokens:build` (style-dictionary — les fichiers générés ne sont pas édités à la main). Anneau désormais distinct : halo bleu clair (~4:1 sur blanc) qui se détache sur fond clair ET sur bouton primary ; bleu ciel clair en nuit (fort sur fond sombre, distinct du primary nuit). **D-02** : focus visible et contrasté conservé sur tous les variants (primary/outline/ghost/destructive) + inputs, jour ET nuit ; **anneau jamais retiré** (RGAA). Fix de token = **global**. Artefact avant/après `docs/showcase/06.46-focus-ring/`. 0 migration, 0 dépendance. DEC-125 LOCKED. Pas d'ADR.
- [x] **Calibrage anneau de focus — icon-buttons + login** (correctif a11y) — `06.47` (livré 2026-06-09) suite de 06.46 : la **couleur** du ring était corrigée, mais `ring-2 + offset-2` (box-shadow plein) restait trop **épais** sur les petits boutons ronds (icônes header brouillons/thème, variant `ghost` 40px) → paraissait un **fond bleu plein « ovale »** ; même cause donnait au bouton login un aspect **pilule** au focus (une cause, deux symptômes). **D-01** : `focus-visible` passé du **ring** (box-shadow pouvant sembler un glow/fond) à l'**`outline`** (reco c) — `focus-visible:outline outline-2 outline-offset-2 outline-ring` → se lit comme un **contour net**, jamais un fond, et suit le `border-radius`. **Harmonisé** base `buttonVariants` (`button.tsx`) ET `theme-toggle.client.tsx` (les deux divergeaient). `ring-offset-background` retiré du base (devenu inutile). **D-02/D-03** : forme/taille des boutons **inchangées** (login reste `rounded-md h-12 w-full`, pas d'ovale dans le code) ; focus visible et contrasté RGAA conservé **jour ET nuit** ; anneau jamais retiré. Inputs hors périmètre (gardent leur ring, plus larges). Composant partagé → propage à tous. Artefact avant/après `docs/showcase/06.47-focus-calibrage/`. 0 migration, 0 dépendance. DEC-126 LOCKED. Pas d'ADR.
- [x] **Bouton auth aligné sur les champs** (finition formulaire) — `06.48` (livré 2026-06-09) le bouton « Se connecter » faisait `h-12` (48px) + `text-base` alors que les `<Input>` font `h-10` (40px) → plus haut que les champs, il « flottait ». **D-01** : bouton submit aligné sur le gabarit des inputs — `h-12` → **`h-10`**, `text-base` retiré (`text-sm` par défaut du Button = comme l'input), `rounded-md` conservé (= radius des inputs). **D-02** : appliqué à **login ET accept-invite** (mêmes 2 formulaires auth) ; accept-invite garde son `variant="accent"` (terracotta DEC-111, hors périmètre couleur). La pile e-mail / mot de passe / bouton forme un gabarit homogène. Cible reste large (pleine largeur ; `h-10`=40px acceptable car la surface horizontale est énorme — l'enjeu touch-target 44px concerne les petites cibles). Couleur bleue (06.44) + focus outline (06.47) inchangés. Artefact avant/après `docs/showcase/06.48-bouton-auth-aligne/`. 0 migration, 0 dépendance. DEC-127 LOCKED. Pas d'ADR.
- [x] **Tableau de bord — densité & alignement (tient sur une page)** — `06.49` (livré 2026-06-09) le dashboard scrollait alors que son contenu tient sur ~430px : la cause était le **layout** (sections empilées, `space-y-24`, KPIs en 4+2, cartes hautes, SLA en section pleine largeur), pas la quantité d'info. Refonte dérivée d'une **maquette throwaway validée par le dirigeant** + **doctrine d'alignement** (Cockpit référence). **D-01 KpiCard anatomie FIXE** : `label→corps→action (mt-auto)`, `h-full` + `items-stretch` (hauteurs égales par rangée), valeur `text-3xl`→**`text-2xl`** ; les 4 variantes (simple/ventilation/multi/alerte) deviennent des **slots** d'une ossature unique. **D-02 échelle resserrée** unique : page `space-y-16`, titre→grille `space-y-8`, grilles `gap-12`, carte `p-16`. **D-03 layout 3 rangées** tenant sur un viewport desktop : **À traiter** `lg:grid-cols-3` (Courses à facturer · Alertes · Délais légaux SLA intégré en 3e col) · **Activité du mois** `lg:grid-cols-6` (6 KPIs sur une rangée, replie `grid-cols-2 sm:grid-cols-3`) · **Conformité & échéances** `lg:grid-cols-2`. **D-04 couleurs en tokens** : `text-green-700`/`text-amber-700` → `text-success`/`text-warning` (+ `bg-*`) dans `kpi-card` + `sla-badges`, jour+nuit, doublage couleur+texte conservé. Ventilation par mode de paiement condensée en contexte (info préservée). `compliance-card` + `sla-badges` passées en `h-full`. **Données INCHANGÉES** (mêmes KPIs/valeurs/liens). Doctrine versée `.planning/doctrine-alignement-dashboard.md` (réutilisable Conformité, etc.). Artefact avant/après `docs/showcase/06.49-dashboard-densite/`. 0 migration, 0 dépendance. DEC-128 LOCKED. Pas d'ADR.
- [x] **Conformité — densité & alignement (doctrine)** — `06.50` (livré 2026-06-09) **2e application** de la doctrine d'alignement (après le dashboard), dérivée d'une maquette validée. L'écran flottait : Chauffeurs/Véhicules occupaient chacun une **section pleine** pour un simple « aucune échéance saisie » (vide structurel + scroll), réglage Avertir/Bloquer en pleine largeur, résumé via un `SummaryCard` maison ≠ dashboard. **D-01** : résumé via la **`KpiCard` partagée** (variant `simple` ; Expirées `state=alerte` si >0, Proches `attention` si >0, Total neutre), grille `lg:grid-cols-3 items-stretch` ; `SummaryCard` maison **supprimée** (cohérence inter-écrans, couleurs via states/tokens). **D-02** : `BlockingModeControl` compacté **sur une ligne** (titre + aide courte à gauche, `SegmentedControl` à droite, `flex justify-between` en `sm:`, aide `max-w-[58ch]`) ; aria + fonctionnement inchangés. **D-03** : Chauffeurs + Véhicules **côte à côte** (`lg:grid-cols-2`) ; état **vide** = ligne discrète bordée muted + lien « Fiches → » (`EmptyEntity`, fin du vide structurel) ; état **rempli** = `ConformiteTable` existant (cohérent Cockpit) ; Convention CGSS pleine largeur (fieldset si vide / table sinon). **D-04** : échelle d'espacement doctrine (`space-y-16`/`space-y-8`, `gap-12`, `p-16`) + section-labels xs uppercase. **Données/logique INCHANGÉES** (mêmes counts, saisies, mode blocage, tableau). Tient sur une page quand peu d'échéances. Artefact avant/après `docs/showcase/06.50-conformite-densite/`. 0 migration, 0 dépendance. DEC-129 LOCKED. Pas d'ADR.
- [x] **Formulaire patient — layout 2 colonnes + patron de form partagé** — `06.51` (livré 2026-06-09) **1re application de la doctrine FORMULAIRE** + extraction d'un patron réutilisable. Le form patient s'étirait en **colonne unique** (invisible d'un coup, dur à relire/repérer une erreur). Recherche : le multi-colonnes est justifié pour la **saisie de données dense répétée** (back-office, la régulatrice saisit à la chaîne) ; anti-saut de champ Baymard = lecture **ligne par ligne**. **D-01** : patron de layout **partagé** `components/form/form-layout.tsx` — `FormColumns` (`lg:grid-cols-2 gap-24`, 1 col < lg), `FormColumn` (`space-y-24`), `FormSection` (titre xs uppercase + `space-y-12`), `FormRow` (`grid-cols-2`, champs lus gauche→droite), `FormActions` (filet + boutons droite). **D-02** : `patient-form` refondu en **2 colonnes** (GAUCHE Identité + Préférences / DROITE Coordonnées + Note), `max-w-[980px]` ; `FormRow` pour Nom/Prénom, Date/Sexe ; **largeurs selon contenu** (téléphone/canal ~240px, date/CP/sexe réduits) ; **champs homogènes h-10** : selects natifs genre/canal restylés au gabarit `Input` (le `ui/Select` Radix n'a pas de `name` → ne soumet pas ; conservé pour la ville avec hidden input), note → **`ui/Textarea`**, datepicker + ville Select `h-48`→`h-10` ; barre `FormActions` (Annuler → /patients + « **Créer le patient** » / « Enregistrer »). **D-03** : new + edit même composant ; `patient-form-constraints` (même page édition) aligné `h-48`→`h-10`. **Données, validation zod, Server Actions, chiffrement NIR INCHANGÉS.** Doctrine versée `.planning/doctrine-formulaires.md` (réutilisable véhicule/chauffeur — lot suivant). Artefact avant/après `docs/showcase/06.51-form-patient-patron/`. 0 migration, 0 dépendance. DEC-130 LOCKED. Pas d'ADR.
- [x] **Formulaires véhicule & chauffeur — patron de form partagé** — `06.52` (livré 2026-06-09) application du patron 06.51 à `vehicle-form` et `driver-form` (encore en style ad hoc : `space-y-16`, `grid-cols-2 gap-8/12`, labels/checkbox bricolés `border-input px-12 py-8`). **D-01 véhicule** : `FormSection` Identification (immatriculation réduite + `FormRow` marque/modèle `Combobox`) · Caractéristiques (type `Select` + `FormRow` places assises/TPMR `NumberField`) · Disponibilité (checkbox propre) · Conformité (`ComplianceFieldset`) + `FormActions`. **D-02 chauffeur** : `FormSection` Identité & contact (nom + `FormRow` téléphone/licence) · Types de permis (grille de checkboxes propres) · Statut (checkbox actif) · Conformité + `FormActions`. **D-03** : champs homogènes (`Field`/`Combobox`/`Select`/`NumberField`), checkboxes en `input` + `Label` propres (fin des labels encadrés bricolés), espacement via le patron. **Layout souple 1 colonne** (les 2 forms sont rendus en `Sheet`, peu de champs) `max-w-[640px]` ; pas de 2 colonnes à moitié vides. `SubmitButton` `w-full`→`h-10` dans `FormActions`. **Combobox marque/modèle + ComplianceFieldset + données/validation/Server Actions INCHANGÉS.** Cohérence CRUD patient/véhicule/chauffeur. Artefact avant/après `docs/showcase/06.52-form-vehicule-chauffeur/`. 0 migration, 0 dépendance. DEC-131 LOCKED. Pas d'ADR.
- [x] **Patron de liste unifié — toolbar + pagination + actions** — `06.53` (livré 2026-06-09) unification des écrans de liste sur `data-table` au-dessus/en dessous du tableau (toolbars bricolées aux alignements divergents `items-center`/`items-end`, paginations hétérogènes : `/courses` « Voir plus » cumulatif, drivers/vehicles/patients aucune). **D-01** : `ListToolbar` + `ListMeta` (`components/data-table/list-toolbar.tsx`, server-safe) — contenant à slots `search` (flex-1 min 260px) · `filters` · `clear` · `actions` (`ml-auto`), hauteur/espacement uniques ; compteur en `ListMeta` SOUS la toolbar. **D-02** : `Pagination` (`components/data-table/pagination.tsx`) par PLAGE (« 1–50 sur 128 ») + Précédent/Suivant grisés en bord + lignes par page optionnel ; pagination par PAGE (offset = `page*pageSize`), pas « voir plus ». **D-03 (règle clé)** : `if (total <= pageSize) return null` — aucune barre sous une liste courte. **D-04** : data-table existant réutilisé tel quel (tri/EmptyState/`footer`/`onRowClick` inchangés). **D-05** : migrés — courses (« Voir plus » → pagination par plage sur `FETCH_CAP=500` borné par date du jour, ListToolbar+ListMeta, pageSize 50), patients (ListToolbar SegmentedControl+PatientSearch + Pagination pageSize 25 + ListMeta), véhicules (Pagination pageSize 50 seule, démontre le seuil). **D-06 (préservé)** : statuts CGSS, **filtre date défaut = aujourd'hui**, colonnes contextuelles, formats FR/974, pageSize par contexte, données/validation/Server Actions/RLS INCHANGÉS ; **pas de sélection multiple/bulk**. drivers/caisse/tarifs/legal : mécaniques, à enchaîner (mêmes composants). Doctrine durable `.planning/audit-ui-pages.md`. Artefact avant/après `docs/showcase/06.53-listes-patron/`. 0 migration, 0 dépendance. DEC-132 LOCKED. Pas d'ADR.
- [x] **Formulaires spécialisés — patron de form (tarifs, sms, legal)** — `06.54` (livré 2026-06-09) application **respectueuse** du patron de form (06.51) aux formulaires spécialisés restés en style ad hoc (`space-y-12/16`, classes brutes, selects `h-32`, textareas brutes sans anneau de focus). Achève l'harmonisation des formulaires CRUD. **D-01** : enveloppe harmonisée écran par écran (`FormSection` pour les groupes, `FormRow` pour champs liés, `FormActions` pour la barre d'action), champs homogènes via `ui/*` (`Textarea` à anneau de focus, selects natifs au gabarit `Input` `h-10`), **mécaniques métier INTACTES**. **SMS** (`template-editor`) : enveloppe harmonisée, insertion variables `{{…}}` (`textareaRef`/caret) + compteur `MAX_LENGTH=160` + aperçu INCHANGÉS ; compteur annoncé `aria-live` + `aria-describedby`. **Tarifs** (`tariff-edit-sheet`) : patron **dans** le `Sheet` (SheetHeader/Footer conservés), `NumberField` prix/€ + simulateur (fichier séparé) intacts ; 2 sections (Période d'application / Paramètres tarifaires). **Legal** : `dpia-form` (3 sections Identification/Analyse des risques/Suivi), `dpo-form` (`FormSection` + `FormActions`), `breach-drawer` + `breach-form-fields` (4 sections, `SelectField` partagé `h-32`→`h-10`) — **libellés RGPD inchangés** (DPIA, périmètre, risque résiduel, Article 33, gravité/nature…). **D-02 (règle valeurs métier)** : les patrons portent la STRUCTURE, pas les valeurs ; variables SMS, termes tarifaires, vocabulaire légal conservés tels quels. **D-03** : logique/validation/Server Actions/mécaniques (insertion SMS, compteur, simulateur, Sheet) INCHANGÉES ; patron 06.51 réutilisé tel quel. Hors périmètre : requests/registre (utilitaires, lot suivant du plan d'audit). Artefact avant/après `docs/showcase/06.54-form-restants/`. 0 migration, 0 dépendance. DEC-133 LOCKED. Pas d'ADR.
- [x] **Parcours chauffeur mobile — debug, géoloc, bottom-sheets, zone pouce** — `06.55` (livré 2026-06-09) doctrine mobile chauffeur sourcée appliquée à la PWA terrain (nature DISTINCTE du back-office : terrain, une main). Captures : bandeau « PWA debug · état détecté : unsupported » visible en prod (anormal), notice géoloc verbeuse, modales centrées. **D-01** : bandeau de diagnostic PWA masqué hors dev (`process.env.NODE_ENV !== 'production'` → inliné/retiré du bundle prod) ; prompt d'install légitime conservé. **D-02** : notice géoloc par COUCHES (sourcé layered privacy notice) — 1re couche toujours visible (quoi + pourquoi + rétention « captée à chaque pointage, liée à la course, conservée 90 j max »), « En savoir plus » (`aria-expanded`/`aria-controls`) déplie le détail (service uniquement, permission refusable — pointage marche sans GPS, retrait/DPO) ; dismiss mémorisé `localStorage` ; pas de dark pattern (refus accessible). **D-03** : composant partagé `components/ui/bottom-sheet.tsx` (Radix Dialog → focus trap, `aria-modal`, Escape, backdrop GRATUITS ; poignée + drag-to-dismiss seuil 96px ; `title` rendu `h2`) ; `end-ride-modal` (Clôturer) et `no-show-modal` (Patient absent) migrés en bottom-sheet (boutons larges en bas, zone pouce ≥44px). **D-04** : carte course + actions déjà conformes (liseré d'état, heure 2xl tabular, patient, mode·urgence, trajet ; primaire `h-14`/56px, « Patient absent » `h-12` outline détaché par filet — anti mis-tap) ; libellés métier conservés (Taxi conv., TPMR, Programmée…). **D-05** : tarif `inputMode="decimal"` CONSERVÉ (clavier chiffres), motif = texte. **D-06** : logique métier (`endRideAction`, no-show, capture géoloc, pointage, file offline Dexie) INCHANGÉE ; `max-w-640` conservé. `prefers-reduced-motion` respecté (règle globale). E2E `driver-workflow-complete` compatible (`getByRole('dialog')` + heading `h2`). Doctrine durable `.planning/doctrine-mobile-chauffeur.md` + maquette `.planning/mockups/conduite-mobile-maquette.html`. Artefact avant/après `docs/showcase/06.55-mobile-chauffeur/`. 0 migration, 0 dépendance. DEC-134 LOCKED. Pas d'ADR (bottom-sheet documenté dans la doctrine, suit le pattern Radix).
- [x] **Onboarding repreneur — méthode de travail versée au repo** — `06.56` (livré 2026-06-09, lot DOCUMENTAIRE pur, hors compte feature comme 06.40) versement de la logique de travail « architecte-chat + Claude Code » pour qu'un repreneur tienne le binôme sans accroc. La méthode (rôles, prompts autoporteurs, maquette-avant-code, recherche sourcée, préservation des valeurs métier, audit post-merge) vivait dans les sessions chat, pas dans le repo. **D-01** : `.planning/METHODE-ARCHITECTE-CHAT.md` (3 rôles dirigeant/CC/architecte-chat, règles d'or, maquette-avant-code, valeurs métier, discipline GSD, boucle de travail, limites — pas d'API GitHub, onboarding ; renvoie à CLAUDE.md + .claude/README.md sans les dupliquer). **D-02** : `.planning/PROMPT-MODELE.md` (gabarit de prompt autoporteur réutilisable + rappels qualité). **D-03** : resync doctrines — règle transversale « préserver les valeurs métier (TAP/CGSS/974) » ajoutée à `doctrine-formulaires.md` ET `doctrine-alignement-dashboard.md` ; `doctrine-mobile-chauffeur.md` mise au contenu canonique sourcé (M1-M6 + M3bis/M6bis). **D-04** : liens vers la méthode depuis `CLAUDE.md` (en-tête), `README.md` et `.claude/README.md` (sans réécrire ces fichiers). **D-05 (périmètre)** : documentaire pur — AUCUN fichier `apps/`/`packages/`/`services/`/`supabase/` touché ; 0 migration, 0 dépendance. DEC-135 LOCKED. Pas d'ADR.
- [x] **Optimisation — alignement léger sur la doctrine** — `06.57` (livré 2026-06-09) alignement cosmétique de l'écran `cockpit/optimisation` sur la doctrine d'alignement (R6 cockpit référence). PAS une refonte : l'écran est fonctionnellement bon (PageHeader date FR, états prêt/skeleton/vide/erreur, vue comparative 2 colonnes responsive, cibles ≥44px, dialog d'application). SEUL écart = cosmétique. **D-01 (échelle d'espacement)** : rythme homogène sur l'échelle unique cohérent avec le cockpit (`comparative-view` marges sous-titres `mt-8`→`mt-12` ; `optimization-shell` séparation avant l'action `gap-8 pt-8`→`gap-12 pt-16`). **D-02 (titres de section harmonisés)** : titres « Plan actuel » / « Plan proposé » passés de `text-base font-semibold` au **kicker** doctrine `text-muted-foreground text-xs font-semibold uppercase tracking-wide` (même style que `alerts-panel` du cockpit) → le titre de page (PageHeader) domine de nouveau. **D-03/D-04 (périmètre)** : structure comparative 2 colonnes, logique d'optimisation, états, dialog d'application, pastilles véhicule, cibles 44px, `aria-labelledby` (plan-actuel-title/plan-propose-title) INCHANGÉS ; valeurs métier (libellés tournées/véhicules/courses, date FR) INCHANGÉES ; pas de maquette (aucune structure nouvelle). Termine l'étape 5 du plan d'audit UI. Artefact avant/après `docs/showcase/06.57-optimisation-alignement/`. 0 migration, 0 dépendance. DEC-136 LOCKED. Pas d'ADR.
- [x] **Lot listes 1/2 : `drivers-list` migration patron + découpe LOC** — `06.58` (livré 2026-06-10) achève la migration des listes **riches** sur le patron 06.53 (DEC-132) ET résout la dette LOC (645 > 300) dans le même lot. **D-01** : toolbar sur `ListToolbar` (filters=`ViewToggle`, actions=« Nouveau chauffeur » vue actifs ; pas de search). **D-02** : compteur en `ListMeta` SOUS la toolbar (logique pluriel/archivé inchangée). **D-03** : `Pagination` par page pageSize 50 à seuil (sous 50 chauffeurs → aucune barre) ; pas de sélecteur lignes/page. **D-04** : découpe LOC (déplacement pur) — `account-status-badge.client.tsx`, `driver-row-actions.client.tsx`, `drivers-empty-state.client.tsx` (export `DriversEmptyState`), `drivers-columns.tsx` (factory `buildDriverColumns`) + `driver-invitation-dialogs.client.tsx` (5e fichier, dialogs invite/resend + état e-mail/soumission — pour cible <300). Orchestrateur **645 → 244 LOC**. **Préservés** : `rowKey` DEC-033, 4 actions DEC-029 + aria-label, valeurs métier DEC-132 D-06 (libellés permis `.toUpperCase()`, badges, colonnes, `tabular-nums`), Server Actions, Sheet, dialogs archive/deactivate/unarchive, `stopPropagation`. typecheck+lint(0 err)+build verts, 129 tests. 0 migration, 0 dépendance. DEC-137 LOCKED. Pas d'ADR.
- [x] **Lot listes 2/2 : listes courtes (legal + tarifs) → `ListMeta` + `Pagination` à seuil** — `06.59` (livré 2026-06-10) termine la généralisation du patron 06.53 (DEC-132) sur les listes courtes (registres légaux, historique tarifs). **D-01** : `ListMeta` au-dessus de chaque DataTable, libellé métier propre (DPIA analyse d'impact / DPA contrat sous-traitant / Violations / Demandes RGPD / Tarifs grille), affiché si non vide. **D-02** : `Pagination` à seuil pageSize 25 (barre masquée sous 25 lignes — voulu). **D-03** : `tariff-history-table` total = `rows.length`, titre + rowKey conservés, ListMeta sous le titre. Migrés : `dpia-list`, `dpa-list`, `breach-list`, `requests-list`, `tariff-history-table`. Valeurs RGPD/CGSS, colonnes, formats FR/974, rowKey, EmptyState, données/Server Actions/drawers INCHANGÉS (présentation seule). **Caisse NON migrée** (décision sourcée : toolbar dédiée déjà conforme, abstraction prématurée ; registre §4.4, rule-of-three). Achève la migration des listes. typecheck+lint(0 err)+build verts, 129 tests. 0 migration, 0 dépendance. DEC-138 LOCKED. Pas d'ADR.
- [x] **Refonte visuelle drawers chauffeur + véhicule (+ primitive Checkbox)** — `06.60` (livré 2026-06-10) inconfort visuel signalé sur le drawer création chauffeur. Pattern drawer JUSTIFIÉ (sourcé) ; 5 défauts d'EXÉCUTION corrigés, partagés par les deux drawers. **D-01** : primitive `components/ui/checkbox.tsx` (vrai input natif, tokenisée — carré 18px, coché bleu + coche blanche, focus ring, cible 24px ; 0 dépendance). **D-02** : permis en chips cliquables (`has-[:checked]:border-primary/bg-primary/10`, `name` inchangé). **D-03** : statut « actif » sorti de FormSection → ligne discrète sous filet. **D-04** : footer ancré via `SheetFooter` (3 zones header figé / corps scrollable / footer figé), + bouton Annuler ghost ; archive déplacé en bas du corps. **D-05** : `max-w-640` retiré (form = largeur drawer). **D-06** : submit primaire bleu (accent réservé toolbar). Champs/libellés/`name=`/logique (useFormState, Server Actions, ComplianceFieldset, Combobox, marque→modèle) INCHANGÉS. Maquette `.planning/mockups/drawers-chauffeur-vehicule.html`. Doctrine formulaire enrichie (§8 page vs drawer, §9 checkbox). Dette tracée : ~14 autres checkboxes brutes → lot dédié. typecheck+lint(0 err)+build verts, 129 tests. 0 migration, 0 dépendance. DEC-139 LOCKED. Pas d'ADR.
- [x] **Brouillons : header → cockpit (indicateur §5.13)** — `06.61` (livré 2026-06-10) le `DraftQueue` (file de brouillons) était dans le header (grammaire notifications) alors que le CdC réserve cet emplacement aux notifications (§5.22) et liste les brouillons comme indicateur du cockpit (§5.13). **D-01** : `<DraftQueue />` retiré du header (`(app)/layout.tsx`) — libère la place pour l'échafaudage messagerie (06.62). **D-02** : nouvel indicateur `cockpit/_components/drafts-indicator.client.tsx` dans l'aside du cockpit (entre AlertsPanel et ComplianceAlertsPanel), MÊME source (`useQuery(['ride-drafts'])` cache partagé, `listDraftsAction`/`deleteRideDraft`/`dispatch RESUME`), présentation panel cockpit (kicker + compteur, réf AlertsPanel), seuil discret « Aucun brouillon ». Ancien `draft-queue.client.tsx` supprimé. Logique brouillons (Server Actions/table/RLS/helpers) INCHANGÉE. typecheck+lint(0 err)+build verts, 129 tests. 0 migration, 0 dépendance. DEC-140 LOCKED. Pas d'ADR.
- [x] **Échafaudage messagerie header (§5.22) derrière `MESSAGING_ENABLED` (OFF)** — `06.62` (livré 2026-06-10) pose la **coquille UI** d'accès messagerie dans le header libéré (06.61), derrière un release toggle OFF par défaut. **Anti-piège** : coquille « en attente d'infra », PAS un mock (ni conversations ni push simulés). **D-01** : flag `MESSAGING_ENABLED` (`turbo.json` globalEnv + `.env.example`, vide=OFF) évalué côté serveur dans `(app)/layout.tsx` (point haut) → `MessagingButton` monté seulement si ON. **D-02** : `components/messaging/messaging-button.client.tsx` (icône `MessageSquare`, DropdownMenu au clic) — (a) Conversations de course = accès `/courses` (germe lot 1 `internal_message`/`ride-chat`, pas de liste fabriquée), (b) Fil général = EmptyState « Bientôt disponible » ; pas de badge non-lus (aucune notion en base). **D-03** : push PWA non construit (registre §1.3). Chat à la course INCHANGÉ (exposé, pas réécrit). Flag OFF → header identique à 06.61. Registre §1.3/§1.4 mis à jour. 0 table, 0 migration, 0 dépendance. typecheck+lint(0 err)+build verts, 129 tests. DEC-141 LOCKED. Pas d'ADR.
- [x] **Échafaudage upload documents conformité derrière `UPLOAD_DOCS_ENABLED` (OFF)** — `06.63` (livré 2026-06-10) `compliance_items.document_url` existe mais aucune UI ne l'alimente ; on pose la coquille d'upload, flag OFF, en attendant le bucket HDS (Phase 09). **Garde-fou santé** : tant que OFF, aucun octet vers un Storage non HDS (Supabase Storage vierge dans le repo → échafaudage pur). **D-01** : flag `UPLOAD_DOCS_ENABLED` (`turbo.json` + `.env.example`, OFF) évalué côté serveur dans les pages, threadé en prop `uploadEnabled` → DriversList/VehiclesList → DriverForm/VehicleForm → ComplianceFieldset (jamais `process.env` client). **D-02** : champ « Document justificatif » par slot — lien « Voir » si url legacy ; OFF = mention désactivée « Téléversement bientôt disponible » (pas d'`input file`) ; ON = zone de dépôt appelant un STUB explicite (« Storage non configuré », pas de faux succès). **D-03** : pas de bucket, pas de migration (colonne existante). **D-04** dissociation : reportée (non triviale). Logique conformité INCHANGÉE. Registre §1.1/§4.3 maj. 0 migration, 0 dépendance. typecheck+lint(0 err)+build verts, 129 tests. DEC-143 LOCKED. Pas d'ADR.
- [x] **Échafaudage notifications email derrière `EMAIL_ENABLED` (OFF)** — `06.64` (livré 2026-06-10) CdC §5.22 prévoit des emails (récap dirigeant, alertes échéances) ; rien n'existe (email vierge). On pose la coquille — module d'envoi + 1 point de déclenchement no-op — flag OFF, en attendant le choix d'un provider (registre §1.2). **Garde-fou** : OFF → aucun email, `send()` no-op loggé ; pas de provider/secret/dépendance ; pas de faux envoi ; périmètre minimal. **D-01** : flag `EMAIL_ENABLED` (`turbo.json` + `.env.example`, OFF) côté serveur. **D-02** : `lib/email/send.ts` — `sendEmail` ne lève jamais ; OFF `{ skipped }` log `[email:disabled]` ; ON `{ sent:false, reason:'no-provider' }` log `[email:no-provider]` (branchement provider = lot dédié). **D-03** : aucune page réglages ni colonne préf → pas de page/table créée ; préférences = reste-à-faire (registre §1.2). **D-04** : `maybeNotifyDeadline` branché dans `upsertComplianceItemAction` (événement existant) — notifie le dirigeant à l'approche/dépassement d'échéance (≤30 j), best-effort, no-op OFF. Alertes in-app/conformité/cockpit INCHANGÉS ; `package.json` inchangé. 0 migration, 0 dépendance. typecheck+lint(0 err)+build verts, 129 tests. DEC-144 LOCKED. Pas d'ADR.
- [x] **Harmonisation — 14 checkbox brutes → primitive `ui/Checkbox`** — `06.65` (livré 2026-06-10) la primitive `ui/Checkbox` (06.60) existait mais 14 fichiers (16 occurrences) gardaient `<input type="checkbox">` brut (dette registre §5). Lot mécanique **iso-comportement**. **D-01** : remplacement 1:1 conservant `name`/`value`/`checked`/`defaultChecked`/`onChange`/`id`/`aria-*`/`disabled`/`data-testid` ; suppression du `type` + classes brutes (portées par la primitive). **D-02** : associations `label htmlFor` conservées. **D-03** : `onChange` natif (e.target.checked), cas `react-hook-form register` + `form.setValue` préservés (forwardRef). **Valeurs RGPD/CGU préservées** (cookie-banner ×3, accept-invite CGU, dpia/breaches/registre/dpo, patient consentement SMS) — `name`/états par défaut inchangés. Aucune exception (16/16 migrées). `grep type="checkbox"` = primitive seule. Dette registre §5 RÉSOLUE. typecheck+lint(0 err)+build verts, 129 tests. 0 migration, 0 dépendance. DEC-145 LOCKED. Pas d'ADR.
- [x] **Primitive Tooltip (Radix) + adresse/patient tronqués au survol/focus** — `06.66` (livré 2026-06-10) le `title` natif (DEC-142) est insuffisant (non stylé, peu fiable clavier/lecteur d'écran) ; on pose une vraie primitive Tooltip ancrée au champ, déclenchée survol + focus. **D-01** : `@radix-ui/react-tooltip` installé (seule dépendance, cohérent écosystème Radix). **D-02** : `components/ui/tooltip.tsx` (shadcn — Provider/Root/Trigger/Content tokenisés, WAI-ARIA 1.2 + WCAG 1.4.13 gratuits). **D-03** : `TooltipProvider delayDuration={400}` monté au layout `(app)`. **D-04** : appliqué aux 2 pastilles (`address-picker-field`, `ride-patient-picker`) — `TooltipTrigger asChild` sur le `<span truncate tabIndex={0}>`, Content = valeur complète, survol + focus clavier, `max-w` wrap. **D-05** : `title` natif retiré. **Garde-fou** : tooltip JAMAIS seul accès (bouton « Changer » conservé) ; pas de tooltip suiveur de curseur ; pas de généralisation (2 pastilles seulement). Logique pickers INCHANGÉE. Doctrine design-system maj. `package.json` +1 ligne. typecheck+lint(0 err)+build verts, 129 tests. 0 migration, 1 dépendance. DEC-146 LOCKED. Pas d'ADR.
- [x] **CI — suppression du sync-types redondant de `cd.yml` (fin de la dérive de re-merges)** — `06.67` (chore, livré 2026-06-10, hors compte feature comme 06.40/06.56) l'historique `main` subissait des re-merges en boucle (06.64/06.65/06.66 re-mergées plusieurs fois) ; contenu final sain (Git déduplique) mais historique pollué + branches en vol périmées. **Cause racine** : DEUX mécanismes redondants de sync de `packages/database/src/types.gen.ts` après chaque CD — (1) `cd.yml` job `sync-types` faisait un **`git push origin HEAD:main`** direct (sans PR) → `main` avançait sans cesse → branches « behind » → re-merges ; (2) `sync-types.yml` crée une PR propre (`peter-evans/create-pull-request@v6`, `delete-branch: true`). **Décision dirigeant — Chemin B** : garder `types.gen.ts` versionné, supprimer le mécanisme redondant. **D-01** : job `sync-types` retiré de `cd.yml` (aucun `needs` ne le visait ; `deploy-migrations`/`deploy-edge-functions` intacts). **D-02** : `sync-types.yml` conservé (seul chemin de sync, par PR propre). **D-03/D-04** : étapes manuelles dirigeant (hors CC) — activer « auto-delete head branches » + fermer la PR sync orpheline éventuelle. **Garde-fous** : `types.gen.ts` reste versionné (pas de gitignore/rm) ; `db:types` local conservé ; `ci.yml`/`preview-smoke.yml`/`setup-vercel.yml` non touchés ; 0 code applicatif, 0 migration, 0 dépendance. Doctrine CI : un seul chemin de sync pour un fichier généré versionné = PR, jamais de push direct sur `main`. DEC-147 LOCKED. Pas d'ADR.
- [x] **Module donneurs d'ordres B2B — cœur livré, extensions à suivre** — `07.01` (livré 2026-06-10) le « Module donneurs d'ordres B2B » (hôpitaux, cliniques, EHPAD) est classé **Inclus V1** par le CdC (§2.1 l.74, détaillé §5.5) ; c'était le SEUL élément de la liste V1 absent de `main`. On livre le CŒUR : référentiel + rattachement course. **Distinction métier** : donneur d'ordres (entité B2B qui commande le transport, convention + facturation centralisée) DISTINCT du prescripteur (CdC §5.5 l.186). **D-01** table `ordering_parties` (raison sociale, SIRET optionnel Luhn, contact principal, modalité de facturation enum, actif/archive) calquée sur `drivers` — RLS `select_same_org` + write dirigeant, audit trigger, pgTAP 13 assertions. **D-02** colonne additive `rides.ordering_party_id` NULLABLE (cas nominal = transport individuel) + index partiel. **D-03** référentiel front `(admin)/admin/donneurs-ordres/` (page/actions CRUD/form drawer/liste) répliquant `vehicules/` ; entrée nav menu **Gestion**. **D-04** champ OPTIONNEL « Donneur d'ordres » dans la saisie express (picker recherche, pattern PatientPicker) ; `ordering_party_id` threadé create/edit/prefill. **Hors lot (registre §6)** : demande groupée, grille tarifaire B2B, récap PDF périodique, contacts multiples par service, portail self-service V1.5. Seed démo 3 établissements 974. typecheck+lint(0 err)+build verts, 124 tests shared. 2 migrations, 0 dépendance. DEC-148 LOCKED. Pas d'ADR.

### ⏸️ Abandonné

- [~] **Phase 07: Mobile native chauffeur — ABANDONNÉE** (décision dirigeant 2026-06-04, DEC-092). Motif : la PWA Phase 04.9 couvre le périmètre terrain retenu, le coût natif (10×, 25-40 h) n'est pas justifié au stade actuel. Réversible si business case mobile validé ultérieurement.

### 🔜 Reste à faire

Ordre logique selon dépendances réelles et ROI.

#### Améliorations techniques pré-production (NOUVEAU — fort ROI, indépendant de HDS)

Bloc identifié par l'analyse RETEX 2026-06-04. Durcit le terrain avant production commerciale, faisable maintenant sans attendre HDS.

- [x] **Phase 06.20: Observabilité Sentry** — **Livré localement 2026-06-05.** `@sentry/nextjs` 8.55 sur `apps/web` (3 runtimes : client / server / edge) + `instrumentation.ts` avec `onRequestError = Sentry.captureRequestError` (capte RSC + Server Actions Next 15). `global-error.tsx` root (UI dégradée + capture). Compo `withSentryConfig(withSerwist(...))` non bloquant si upload source maps bute. **Zéro PII santé** : `sendDefaultPii: false`, scrubbing `beforeSend` partagé (`lib/sentry/scrub.ts`) qui retire NIR / nom / prénom / adresses / téléphone / email / date_naissance / tokens / cookies / Authorization headers, query strings URL retirées, user → id auth seul. Session Replay OFF (laissé en commentaire avec `maskAllText: true` + `blockAllMedia: true` si réactivé). `captureException` ajouté dans optimizer + geoloc routes. `turbo.json` globalEnv complété (5 vars Sentry + `VERCEL_ENV` + `CI` + `GEOLOC_ENABLED`). `.env.example` documenté (dev sans DSN no-op). `pnpm.overrides` étendu de `next: 15.5.19` pour dédup Sentry/opentelemetry. 6 tests Vitest scrub. DEC-097. **Pas de nouvel ADR** (activation d'un choix acté DEC-003). 0 migration BDD.
- [x] **Phase 06.21: Tests RLS — couverture complète** — **Livré localement 2026-06-05.** Couverture RLS étendue de **13 → 24 tables** (les 11 trous comblés). Infra pgTAP déjà en place (CI `supabase test db`, version épinglée 2.98.2) — seule la couverture manquait. 11 nouveaux fichiers de test : `ride_events_rls.sql` + `ride_recurrences_rls.sql` + `ride_recurrence_exceptions_rls.sql` (critique santé/traçabilité) + `cgu_acceptance_rls.sql` + `cookie_consent_log_rls.sql` + `legal_request_attempts_rls.sql` + `tariff_grids_rls.sql` + `sms_messages_rls.sql` + `sms_templates_rls.sql` (important RGPD/métier) + `pois_metier_rls.sql` + `holidays_974_rls.sql` (mineur référentiels). Gabarit `rides_rls.sql` réutilisé (fixtures multi-tenant + rôles métier). Vérifs standard : RLS activée, cross-tenant strict, WITH CHECK, isolation par rôle, anon refusé. 0 policy modifiée (D-04). 3 observations `force row level security` non posé tracées (ride_events / tariff_grids / sms_messages) — pas des trous (rôle `authenticated` ne contourne pas RLS). DEC-098. **Pas d'ADR** (activation choix DEC-002/013). 0 migration BDD.
- [x] **Phase 06.22: Error boundaries par segment** — **Livré localement 2026-06-05.** Couverture étendue à 5 segments majeurs (`(app)`, `(admin)`, `(auth)`, `(public)`, `(driver)`) + 2 sous-segments critiques (`/cockpit`, `/conduite`). Gabarit commun `<SegmentError>` (`components/error/segment-error.client.tsx`) : capture Sentry au mount avec tag segment (06.20), `role="alert"` + `autoFocus` sur le bouton + `aria-live="assertive"`, stack visible UNIQUEMENT en dev (`<details>` JAMAIS en prod). Bouton Réessayer = `reset()` Next 15, 0 dépendance réseau (`/conduite` fonctionne offline). Message conduite rassure sur la file offline (sync engine 04.9, pointages sauvegardés). Upgrade `tableau-de-bord/error.tsx` vers le gabarit (capture Sentry ajoutée). Tokens 06.14 (0 hex). 5 tests Vitest. DEC-099. **Pas d'ADR** (activation pattern Next 15). 0 migration BDD.
- [x] **Phase 06.23: Durcissement couche données — Audit DEC-041 + tests métier** — **Livré localement 2026-06-05.** Volet A : audit complet DEC-041 sur 24 SA avec mutations. 11 vrais trous comblés (`(auth)/accept-invite` x2, `courses/assignment` x3, `courses/payment`, `legal/dpia`, `legal/breaches`, `legal/dpo`, `legal/requests` x2, `legal/_actions/cgu-accept`) + 1 confirmation déjà fait (sms-templates) + 2 N/A documentés (`setup/actions` string ops, `(public)/legal/request/[token]` service_role bypass). Pattern `.select('id')` + check `data.length === 0` + message « refusée — droits insuffisants ». Volet B : tests ciblés sur angles morts mesurés (`pnpm exec vitest run --coverage`). 3 fichiers de tests / 11 nouveaux tests. Couverture branches améliorée : `geocode-safety-net` 84.61 % → **100 %**, `scrub` 61.29 % → **77.14 %**, `solve-local` 90.74 % → **92.42 %**. `@tap/pricing` + `@tap/recurrence` 100 % maintenus. 1 nouvelle devDep (`@vitest/coverage-v8`). DEC-100. **Pas d'ADR** (complétude patterns acté DEC-041/013). 0 migration BDD, 0 policy modifiée.

#### Phase 09 — Migration HDS (verrou 1er client payant)

- [ ] **Phase 09: Migration HDS** — Hébergement sur infra HDS-certifiée. Recherche 2026-06-04 : TAP n'a pas à être certifié lui-même (héberger chez un certifié HDS v2.0 + addendum CNIL). Voie technique = self-host stack Supabase complète sur infra HDS (Postgres + Auth + Realtime + Storage + Edge Functions). L'architecture portable CON-001 est déjà prête (Docker + scripts CI/CD). Candidats pré-instruits : **OVHcloud HDS** ou **Scaleway HDS** (AWS écarté CLOUD Act). Décision fournisseur à trancher en discuss dédié (ADR séparée). **Inclut** : activation SMS HDS (Twilio sortant via passerelle EU), audit RLS systématique avec tests pgTAP (cf. ci-dessus), audit complet DEC-041, activation pg_cron retention 90j (`purge_driver_positions`), activation flag `GEOLOC_ENABLED=true`. **Depends on: décision business « viser 1er client payant ». Estimation : à cadrer en discuss.**

#### Phase 10 — Géoloc opérationnelle réelle (post-HDS)

- [ ] **Phase 10: Géolocalisation opérationnelle temps réel** (ex-Phase 08) — Largement câblée par **Phase 10.0** (prototype 2026-06-04). Périmètre Phase 10 = bascule réelle :
  1. Activer `GEOLOC_ENABLED=true` après HDS (DEC-096 réversible).
  2. RGPD effectif : information préalable CGU/CGV, registre des traitements à jour, rétention 90j activée (pg_cron).
  3. Capture premier-plan opportuniste (D-04 watchPosition différée en 10.0) : ajout watch/clear opportuniste tant que le chauffeur reste sur la PWA en premier plan (barrière PWA documentée — pas de continu garanti, RETEX).
  4. Cockpit : conserver le contrat « dernière position connue + âge », jamais de faux « live ».
  5. ETA temps réel (régulateur + patient SMS) sur la base des dernières positions connues.
  6. **OSRM hors périmètre** (DEC-056 : Haversine corrigée + cumul GPS suffisent pour les indicateurs « estimés » DEC-081 ; réévaluation V2 si tracé routier précis requis).
  - **Depends on: Phase 09 (HDS — DEC-075, position véhicule = donnée de santé indirecte). Estimation : à cadrer en discuss post-HDS.**


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
**Status**: **Complete (2026-06-03)** — 5 PR Wave 1 (#207..#212 hors #211) + 1 PR Wave 2 (#211). Chaîne Vercel Python OR-Tools techniquement fonctionnelle (`/api/solver/health` 200). Walkthrough complet bloqué Vercel Hobby (plafond maxDuration 10s). Décision dirigeant 2026-06-03 : mock activé partout pour phase tests, vrai solveur reporté à Phase 06.11 candidate. Pipeline geocoding scellé par 3 tests Vitest (cas A déjà câblé Phase 04.7).
**Canonical refs**: `.planning/phases/06.10-dettes-techniques-phase-06.7/SUMMARY.md`, `docs/adr/ADR-009-pattern-hebergement-services-couteux.md`, `docs/dette-technique/2026-06-03-enquete-patterns-solveur-cout.md`.

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
**ABANDONNÉE — décision dirigeant 2026-06-04 (DEC-092).** Mobile natif écarté, PWA 04.9 suffisante au stade actuel. Section conservée pour traçabilité GSD.

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
