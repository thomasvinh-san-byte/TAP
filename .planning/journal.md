# Journal — phases livrées

## 2026-06-04 (suite) — Phase 06.19 livrée localement (branchement géocodage récurrences + filet serveur)

Phase 06.19 « Branchement géocodage (récurrences + filet serveur) » cadrée + exécutée dans une seule PR. Comble le trou applicatif qui privait `solveLocal` (06.12, livré le même jour) des courses récurrentes — segment **dialyse** = transport le plus mutualisable, donc le plus coûteux à rater.

**État vérifié AVANT** : la table `ride_recurrences` avait déjà les 6 colonnes `pickup_lat/lng/citycode` + `dropoff_*` depuis la migration `20260519000001_ride_recurrences.sql` (Phase 05). Le trou était purement applicatif (`patients/actions/recurrences.ts` schéma Zod + INSERT ignoraient ces colonnes). **0 migration BDD ajoutée**.

**Composants nouveaux** :
- `apps/web/src/lib/geocoding/geocode-safety-net.ts` — helper partagé `geocodeIfMissing(address, lat, lng, citycode)`. Idempotent (court-circuit si coords présentes), non bloquant (BAN down → null), pure pour le test. 6 tests Vitest.
- `apps/web/src/lib/recurrence/build-rides-payload.ts` — pure helper de transformation occurrences → INSERT rides[]. Propage les coords du template à chaque ride générée. Extrait pour testabilité. 5 tests Vitest.

**Modifs schémas / Server Actions** :
- `patients/actions/recurrences.ts` : Zod `baseSchema` étendu de 6 champs coords (`numericFromString` + bornes lat ±90 / lng ±180 / citycode max 10), `BASE_KEYS` factorisée, `createRecurrenceAction` + `updateRecurrenceAction` appellent `geocodeIfMissing` avant INSERT/UPDATE et persistent les coords sur `ride_recurrences`. `regenerateOccurrencesFor` reçoit les coords pour propagation. Helper local supprimé au profit du module partagé.
- `courses/actions/create.ts` : `createRideAction` appelle `geocodeIfMissing` avant INSERT (filet pour saisies sans picker — seed, API tierce, brouillons texte libre). Helper local supprimé au profit du module partagé.

**UI** :
- `recurrence-create-modal.client.tsx` : 2 `<Input>` remplacés par 2 `<AddressOrPOIPicker>` (pickup + dropoff). State coords pour threading. Submit pose les 6 champs coords dans FormData. Reset complet au close. Bouton submit désactivé si adresse vide.
- `recurrence-edit-modal.client.tsx` : idem + initialisation des coords state depuis `recurrence.pickup_lat/lng/citycode` (déjà chargées via `RideRecurrence` row).
- `optimization-shell.client.tsx` (cockpit) : empty state coords-vides reformulé « X course(s) exclue(s) faute de coordonnées géographiques » + lien `/admin/maintenance`.

**Backfill `/admin/maintenance/actions.ts`** : `backfillRideGeocodingAction` étendu de 3 passes :
1. Pass 1 (existant) : `rides` avec `pickup_lat IS NULL` (MAX_PER_RUN = 200, rate-limit 1 req/s).
2. Pass 2 (nouveau) : `ride_recurrences` actives avec `pickup_lat IS NULL` → géocode + UPDATE template.
3. Pass 3 (nouveau) : propagation aux occurrences futures non démarrées (`validee` + `assignee`, `scheduled_at > now`, `pickup_lat IS NULL`) — cohérent avec la cascade DEC-048 qui préserve courses `en_cours` / `terminee` / `annulee`.

Audit log enrichi du compteur `recurrences_processed`. Idempotent, dirigeant only.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (apps/web)
- `pnpm lint` clean (9 warnings préexistants hors périmètre)
- `pnpm test` 101/101 verts (+11 nouveaux : 6 geocode-safety-net + 5 build-rides-payload). Tous les tests Vitest existants restent verts.
- `git diff main --name-only | grep '^supabase/migrations/'` = 0 ligne (aucune migration ajoutée).
- 0 nouvelle dépendance npm.

**Pont vers 06.12** : le bénéfice est immédiat. Les récurrences dialyse étaient le scénario où `solveLocal` (heuristique cluster-first/route-second) trouvait théoriquement le plus de gain — fenêtres temporelles serrées, horaires quasi-fixes, mêmes destinations partagées par plusieurs patients. Avec coords remplies, `transform.ts` (`ridesToSolveRequest`) ne les exclut plus pour `no_coordinates`, et `solveLocal` peut grouper. Le ROI de la phase est entièrement porté par 06.12 (livré juste avant).

## 2026-06-04 (suite) — Phase 06.12 livrée localement (solveur heuristique TS natif, OR-Tools/Python/mock supprimés)

Phase 06.12 « Solveur d'optimisation = heuristique TypeScript native » cadrée + exécutée dans une seule PR. Décision tranchée (dirigeant + recherche OR) : abandonner OR-Tools / Python / mock / hébergement séparé. Réécriture en heuristique TS native dans `apps/web/src/lib/optimizer/`. Autoporteur, zéro coût marginal, zéro hébergement externe.

**Motivation (faits)** :
- Volume réel ≤ 500 courses absolu, en pratique quelques dizaines/jour. Le contrat zod plafonne déjà à `rides.max(200)`.
- OR-Tools est calibré pour 1000+ waypoints — disproportionné ; sa lourdeur (binaires C++ ~75 MB) a bloqué l'hébergement Vercel (5 PR de fix Phase 06.7 + 5 PR Phase 06.10), d'où le mock actuel.
- Pour fenêtres temporelles petites + horaires quasi-fixes (dialyse programmée = cas TAP majoritaire), une heuristique greedy cluster-first/route-second est quasi-optimale.
- Indicateurs « estimés » DEC-081 → exactitude non contractuelle.
- Supprime la SEULE vraie barrière (hébergement). Plus de Python, plus de cold start, plus de mock, plus d'hébergeur tiers, plus de plan Vercel Pro à arbitrer.

**Composants nouveaux** :
- `apps/web/src/lib/optimizer/haversine.ts` — port direct des 44 lignes de `solver.py:haversine.py`. `haversineKm()` + `distanceMatrix(coords, correctionFactor)`. 4 tests Vitest.
- `apps/web/src/lib/optimizer/solve-local.ts` (~280 LOC) — heuristique cluster-first/route-second. Pré-filtre fenêtres temporelles (port `_pre_filter_rides`), appariement greedy 2-par-2 sur compat fenêtre + transport_mode→vehicle.type + capacité, ordre nearest-neighbor sur Haversine corrigée, calcul km_a_vide. Export `timeWindow()` testable. 9 tests Vitest portés des 6 scénarios pytest.

**Branchement Route Handler** (D-03) : `apps/web/src/app/api/optimizer/route.ts` point 7 — remplace le bloc `useMock ? mockSolve(payload) : solve(payload, {HTTP})` par un `solveLocal(payload)` synchrone. Conservé : auth Supabase, vérif rôle, dé-identification D-08, `ridesToSolveRequest`, `solveResponseToProposal`, `enrichProposal`, try/catch défensif. Retiré : imports `solve`/`OptimizerError`, `process.env.OPTIMIZER_USE_MOCK`, `VERCEL_URL`/`serviceUrl`, `timeoutMs: 30000`.

**Suppressions** (D-04) :
- `apps/web/py/solver/` (13 fichiers Python : solver.py, _extract.py, haversine.py, models.py, index.py, requirements*.txt, tests/, README.md, pytest.ini) → supprimé intégralement.
- `apps/web/src/app/api/optimizer/_mock-solver.ts` → supprimé.
- `apps/web/vercel.json` : `builds` Python + `routes` `/api/solver/*` retirés (reste un fichier `$schema` minimal).
- `packages/optimizer-client/src/client.ts` (`solve()` HTTP + `OptimizerError`) → vidé. `index.ts` ne re-exporte plus `./client`.
- `packages/optimizer-client/src/__tests__/client.test.ts` (4 tests du client HTTP) → supprimé.
- `apps/web/src/middleware.ts` : commentaire ADR-009 référant à `apps/web/py/solver/` → retiré.

**Contrat préservé** : `packages/optimizer-client/contract.ts` (zod `SolveRequestSchema` / `SolveResponseSchema`) + `transform.ts` (`ridesToSolveRequest`, `solveResponseToProposal`) inchangés. `solveLocal()` produit exactement le même `SolveResponse` qu'OR-Tools. Le frontend `/cockpit/optimisation` ne voit aucun changement.

**Documentation** :
- ADR-010 « Solveur heuristique TS native » créée, supersede ADR-008 (hébergement Vercel Python) + ADR-009 (pattern container long-running).
- DEC-093 LOCKED inscrite dans STATE.md (Decisions).
- Runbook `runbook-bascule-vercel-services-vers-deux-projets.md` rendu sans objet pour le solveur (conservé pour traçabilité ou usage futur).

**Variables d'env devenues obsolètes** (à retirer Vercel post-merge) : `OPTIMIZER_USE_MOCK`, `OPTIMIZER_SERVICE_URL`.

**Validation** :
- `pnpm typecheck` propre
- `pnpm build` vert (apps/web)
- `pnpm test` 90/90 verts (+13 nouveaux : haversine 4 + solveur 9 ; -4 retirés client HTTP). 17/17 verts `@tap/optimizer-client` (contract 7 + transform 10).
- `grep -rn 'ortools' apps/web` = 0 référence active.
- `apps/web/py/solver/` = supprimé. `_mock-solver.ts` = supprimé.
- 0 migration BDD, 0 nouvelle dépendance npm.

## 2026-06-04 (suite) — Sync planning post-audit (06.11 + 06.18 + total_phases + DEC-092 abandon 07)

Audit planning passé. Trois corrections + une décision dirigeant en une PR planning-only.

1. **06.11 (Polish produit) cochée** : phase livrée (PR #214-#217, statut détaillé « Complete (2026-06-03) ») mais sa checkbox ROADMAP était restée `[ ]`. Corrigée.
2. **06.18 (Page de connexion) clôturée** : livrée via PR #233 (mergée). Checkbox passée `[x]` avec préfixe livraison.
3. **`total_phases` réaligné 29 → 31** : la ROADMAP comptait 31 lignes de phases mais STATE en déclarait 29 — l'ajout de 06.17 puis 06.18 n'avait jamais été propagé au compteur. Compteurs : 26/31 livrées, 4 ouvertes actives, 1 abandonnée. Percent 84.
4. **DEC-092 — Phase 07 (Mobile natif) ABANDONNÉE** (décision dirigeant 2026-06-04). Motif : la PWA Phase 04.9 couvre le périmètre terrain retenu, le coût natif (10×, 25-40 h) n'est pas justifié au stade actuel. Réversible si business case mobile validé ultérieurement. Conservée en ROADMAP pour traçabilité (marquée `[~]` avec préfixe ABANDONNÉE). Phase 10 (géoloc) reformulée : la référence orpheline à 07 a été retirée, le discuss 10 devra concevoir une solution PWA premier-plan dégradé, pas de fallback natif.

Candidates ouvertes restantes (4) : 06.9 (Next.js 15), 06.12 (réactivation solveur OR-Tools), 09 (HDS), 10 (géoloc temps réel). Pas de suite design « naturelle » — choix dirigeant requis pour la prochaine phase.

## 2026-06-04 (suite) — Phase 06.18 livrée localement (Page de connexion + AuthShell aux normes)

Phase 06.18 « Page de connexion — champs + UI aux normes » cadrée + exécutée dans une seule PR (périmètre léger ~4-6 h). Application directe des normes auth/UI 2025-2026 (NN/G, muz.li 4 problèmes login, web.dev, UX Patterns, anti-autofocus a11y) à `/login` et `/accept-invite`. **Reset MDP exclu** (décision dirigeant).

**Composants nouveaux** :
- `<PasswordInput>` (`apps/web/src/components/form/password-input.client.tsx`) — wrapper `<Input>` avec toggle œil/œil-barré (`Eye`/`EyeOff` lucide), `type={visible ? 'text' : 'password'}`, `aria-label` parlant (« Afficher / Masquer le mot de passe »), `aria-pressed` reflète l'état, `pr-40` pour éviter le chevauchement texte/bouton, `forwardRef` pour compat RHF `register`. W3C ARIA APG. 5 tests Vitest.
- `<ThemeToggle>` (`apps/web/src/components/theme-toggle.client.tsx`) — bouton standalone Sun/Moon, `aria-label` parlant, `aria-pressed` reflète l'état, cible tactile 40 px, focus visible via `--ring`. Posable hors session auth (header form AuthShell). 4 tests Vitest.
- `useTheme()` hook partagé (`apps/web/src/lib/use-theme.client.ts`) — lecture `data-theme` du document + persistance localStorage `theme` (clé compat anti-FOUC `app/layout.tsx`). Consommé par `<ThemeToggle>` ET `UserMenu` → DRY (~20 LOC supprimées de UserMenu).

**Refactor AuthShell en Server Component (D-06)** : `apps/web/src/app/(auth)/_components/auth-shell.client.tsx` supprimé → `auth-shell.tsx` (RSC). Le seul îlot client est `<ThemeToggle>` posé dans le header form (bascule jour/nuit avant connexion). Imports redirigés dans 4 pages (`login`, `accept-invite`, `welcome`, `setup`). Commentaires « mode jour uniquement » périmés retirés.

**login-form** : email gagne `inputMode="email"` (D-02 — clavier email mobile). Mot de passe utilise `<PasswordInput>` (D-01). Aucun autofocus (anti-pattern a11y respecté).

**accept-invite-form** : 2 champs password convertis en `<PasswordInput>` avec recomposition manuelle du pattern Field (label + PasswordInput + p#hint OR p#error + aria-describedby) — PasswordInput n'est pas un Input simple, ne s'intègre pas directement à `<Field>`. Import `Field` retiré (lint propre).

**Validation** : `pnpm typecheck` propre, `pnpm lint` clean (9 warnings préexistants hors périmètre), `pnpm test` 77/77 verts (11 fichiers ; +9 nouveaux : PasswordInput 5 + ThemeToggle 4). 0 migration BDD. 0 nouvelle dépendance npm (toutes icônes lucide déjà disponibles). Tokens 06.14 uniquement, 0 hex.

## 2026-06-04 (suite) — Phase 06.17 close (3 PR mergées)

Phase 06.17 « Conformité des champs de saisie » **close** après 3 PR séquentielles mergées : PR #230 (composants communs + véhicule/chauffeur), PR #231 (légal + tarifs + rattrapage défauts places), PR #232 (reste + clôture). **132 champs aux normes UX/a11y** (NN/G, Deque, Shopify Polaris, USWDS, W3C ARIA APG). Composants communs : `<Field>` (hint persistant lié `aria-describedby`, `name` explicite respecté), `<NumberField>` (`type=text` + `inputMode=numeric|decimal`, règle de défaut cohérent counter/optional), `<Combobox>` 100 % maison W3C APG (DEC-003 préservée, sans Radix Popover ni cmdk). Catalogue `lib/vehicles/catalog.ts` (13 marques × ~5 modèles + `normalizeBrandOrModel` Title Case). PR3 : migration `dpia-form`, `dpa-prefill-card`, `dpo-form`, `accept-invite-form` sur `<Field>` + hints d'exemple ; `maxLength` posée sur tous les champs à format (immat=9, NIR=19, tél=14, email=120, version=50, titre=200, mot de passe=128) ; normalisation submit DPA. **0 `type="number"` restant** dans `apps/web/src` (vérifié `grep -rE 'type=\"number\"'`). **23 tests Vitest** verts (Field 5 + NumberField 8 + Combobox 8 + catalog 7) sur 68 tests total. Documenté `docs/design-system/07-form-completion.md`. 0 migration BDD, 0 dépendance npm. Bloc design system 06.13 → 06.17 complet sur 5 phases.

## 2026-06-04 (suite) — Phase 06.17 cadrée + PR1/3 exécutée

Phase 06.17 « Conformité des champs de saisie » cadrée. Périmètre élargi en cours de session : tous les champs du projet (132 sur 50 fichiers) à mettre aux normes UX/a11y (NN/G, Deque, Shopify Polaris, USWDS, W3C ARIA APG), pas un pilote. Découpé en 3 PR séquentielles SOUS la même phase. **PR1 (#230) livrée localement** : composants communs `<Field>` (hint persistant lié `aria-describedby`) + `<Combobox>` éditable 100 % maison W3C APG (DEC-003 préservée, 0 nouvelle dépendance) ; catalogue `lib/vehicles/catalog.ts` (13 marques × ~5 modèles + `normalizeBrandOrModel` Title Case) ; refactor `vehicle-form` (Marque/Modèle comboboxes dépendantes, immatriculation hint format, places en `inputMode=numeric` sans spinner) ; `driver-form` migré sur `<Field>` commun ; normalisation Title Case au submit Server Action véhicule. 60 tests Vitest verts (15 nouveaux : Field 5 + Combobox 8 + catalog 7). Documenté `docs/design-system/07-form-completion.md`. **PR2 prévue** : légal + tarifs (breach-drawer affected_subjects_count défaut 0, registre-fields durée conservation, tariff-edit/simulator/override-tarif montants/distance avec inputMode décimal sans spinner). **PR3 prévue** : dpia/dpa-prefill/accept-invite/dpo (hints d'exemple), audit `patient-form-fields` (gabarit déjà conforme), driver-form téléphone + maxLength, NIR maxLength=15, sync ROADMAP cocher 06.17. 0 migration BDD, 0 dépendance npm.

## 2026-06-04 (suite) — Phase 06.16 cadrée + exécutée

Phase 06.16 « PageHeader admin commun » cadrée + livrée dans une seule PR (périmètre Strict dirigeant). Composant `<PageHeader>` créé (~50 LOC, props title + description + actions + className, 6 tests Vitest verts). 16 pages admin migrées (chauffeurs, facturation, legal, legal/breaches, legal/dpa, legal/dpa/pre-remplir, legal/dpia, legal/dpia/pre-remplir, legal/dpo, legal/registre, legal/registre/pre-remplir, legal/requests, maintenance, sms-templates, tarifs, vehicules). `legal/registre` conserve ses actions `ExportPdfButton` + bouton « Nouvelle entrée » via le slot `actions`. Chrome globale (`(admin)/layout.tsx`, `NavTabs`, `LegalNavMenu`) inchangée. Toolbar recherche/filtres différée (recoupe le tri généralisé du `<DataTable>` laissé en V2). Tokens 06.14 uniquement, 0 hex, 0 dépendance, 0 migration BDD. Documenté en `docs/design-system/06-page-header.md`.

## 2026-06-04 (suite) — Phase 06.15 cadrée

Phase 06.15 « Refonte data tables » cadrée. Décision dirigeant Option 3 (uniformiser les 13 tables sur un composant `<DataTable>` sémantique commun, API extensible tri/pagination prévus mais V1 implémente seulement le tri existant de `caisse-table`). 13 tables incluses (8 `<table>` + 4 `divide-y` + 1 mixte) ; 3 dropdowns de saisie exclus (pas des data tables). Décisions D-01..D-06 LOCKED : composant sémantique, compose primitives existantes (EmptyState/Badge/Skeleton + tokens 06.14), API extensible, logique métier préservée par table, RGAA 4.1.2 + densité DEC-034 + jour+nuit, ROADMAP entrée [ ] = premier acte. Estimation 12-16 h. 0 migration BDD, 0 dépendance npm. PLAN 06.15-01 à écrire ensuite.

## 2026-06-04 — Phase 06.14 cadrée

Phase 06.14 « Migration tokens.json → Tailwind config » cadrée. Entrée ROADMAP posée `[ ]` après 06.13. RESEARCH sourcé (versé en PR #220, mergée) rangé dans le dossier de phase `.planning/phases/06.14-migration-tokens-tailwind/06.14-RESEARCH.md` pour cohérence de structure GSD. STATE + journal mis à jour (06.14 en cadrage). Décisions dirigeant déjà actées : dark généré depuis les tokens (anti-dérive), rester Tailwind v3 (v4 = décision séparée couplée à 06.9). Architecture DTCG du dark à trancher au discuss (Token Sets vs `$value` structuré). Estimation indicative 5-8 h. Périmètre dark chiffré : 12 couleurs sur 57 tokens.

## 2026-06-03 (suite) — Phase 06.13 lancée et livrée

Phase 06.13 « Foundations design system » lancée et livrée en 1 PR documentaire pure. 4 livrables : 01-foundations.md (doctrine WCAG 2.1 AA + RGAA 4.1.2 + conventions visuelles), tokens.json (W3C Design Tokens 2025.10), 02-patterns-emergents.md (5 patterns réutilisables documentés : KpiCard, EmptyState, RideBadge, SlaBadgesCard, HautsBadge), 03-benchmark-foss.md (recherche FOSS méthodique capitalisée en version compacte). DEC-088 doctrine accessibilité, DEC-089 étoile polaire hybride Carbon+Atlassian+NHS, DEC-090 phase 100% documentaire, DEC-091 chantier PDF reporté. Base établie pour phases 06.14+ (migration tokens, refonte tables, refonte settings).

## 2026-06-03 (suite) — Phase 06.11 cadrée

Phase 06.11 « Polish produit » créée et cadrée : CONTEXT + DISCUSSION-LOG + 3 PLAN par wave. Périmètre : Wave 1 tableau dirigeant (A3+A5+A4, HVI 2026 pattern), Wave 2 passe UX optimisation (B2+B3+B9+B7+B6, Solvice + RoadWarrior + tule2236), Wave 3 finition démo (C1+C7). Items A2/B8/C3/C5 explicitement reportés. D4-a side-quest opportuniste inscrit dans CONCERNS.md. Renumérotation : ancienne 06.11 candidate solveur → 06.12 candidate. DEC-084..087 LOCKED. 4 décisions traçables dans le DISCUSSION-LOG. PR cadrage = documentation pure, 0 ligne de code applicatif touchée.

## 2026-06-03 — Phase 06.10 clôturée

5 PR Vercel Python (#208, #209, #210, #212) + 1 PR Wave 2 (#211). Chaîne Python techniquement fonctionnelle, mais walkthrough OR-Tools réel bloqué sur Vercel Hobby (maxDuration 10s). Pipeline geocoding déjà câblé depuis 04.7, scellé par tests. Décision dirigeant : mock activé partout, Phase 06.11 candidate pour réactivation. Enquête open-source `2026-06-03-enquete-patterns-solveur-cout.md` capitalise les 4 patterns d'hébergement viables.

Dettes ouvertes à l'issue : D1 reportée (Phase 06.11 candidate), D2 résolue, D3 et D4 différées.

---

*Journal créé 2026-06-03 lors de la clôture de Phase 06.10. Toute clôture de phase à venir s'inscrit ici en tête.*
