# Phase 06: Facturation CGSS PDF + audit sécurité + dettes CI — Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 06 (resserrée) livre trois choses :

1. **Facturation CGSS** sous forme de **PDF récapitulatif mensuel**, qui consomme le moteur de tarif livré en 05.5.
2. **Audit de sécurité systémique** : RLS de toutes les tables métier + toutes les Server Actions + ~50 advisors Supabase.
3. **Résolution des 3 dettes CI V1.5** (D1/D2/D3).

Ce périmètre est le résultat d'un **arbitrage de découpage**. La « Passe 4 » brute de la ROADMAP (HDS + OR-Tools + B2B + facturation + audit, estimée 19-32 h) était trop lourde et trop hétérogène pour une seule phase. Elle est scindée — voir « Découpage des 6 blocs » ci-dessous.

**Dans Phase 06 :** Bloc A (facturation CGSS PDF), Bloc E (audit RLS + Server Actions + advisors sécurité), Bloc F (dettes CI).
**Hors Phase 06 :** Bloc B (HDS) → sous-phase 06.5 ; Bloc C (OR-Tools) → sous-phase 06.7 ; Bloc D (B2B) → différé via ADR ; télétransmission B2/SEFi/CNDA → différée via ADR.

</domain>

<decisions>
## Implementation Decisions

### Arbitrage central — échéance réglementaire B2/CNDA (31 mai 2026)

Question : l'échéance « facturation B2 logiciel certifié CNDA, 31 mai 2026 » (dans 11 jours) impose-t-elle de livrer la télétransmission en Phase 06 ?

**Réponse du dirigeant** : TAP a un **design partner en test, sans facturation CGSS** depuis l'outil aujourd'hui.

- **D-01** — L'échéance du 31 mai **ne pèse pas sur TAP**. La certification CNDA / norme B2 / formulaire 606b concerne le **taxi qui télétransmet** à la CGSS, pas l'éditeur d'un SaaS en bêta dont aucun client ne facture encore. La télétransmission B2/SEFi/CNDA est **différée** dans une phase dédiée, échéance à réévaluer dès qu'un client réel facture. Aucune tentative de B2/CNDA en Phase 06 (projet en soi : certification logiciel, norme B2, tests SEFi — intenable en 11 jours et sans valeur immédiate).
- **D-02** — La facturation V1.5 = **PDF récapitulatif mensuel** par organisation (et par chauffeur), qui agrège les courses facturables CGSS et leurs montants calculés par le moteur 05.5. Document utilisable manuellement par le dirigeant. Pas de transmission électronique.

### Découpage des 6 blocs de la Passe 4

Matrice valeur × risque × effort × dépendance et décision par bloc :

| Bloc | Valeur | Risque | Effort | Dépendance | Décision |
|---|---|---|---|---|---|
| **A — Facturation CGSS PDF** | Élevée (cœur métier de la passe, livrable concret) | Faible-Moyen | ~4-6 h | Moteur pricing 05.5 (livré), `@react-pdf/renderer` (déjà présent Phase 1.5) | **Phase 06** |
| **B — Migration HDS** | Élevée pour la prod commerciale ; nulle pour la bêta actuelle | Élevé (RLS, Auth, pg_cron, Vault, Realtime, données santé) | ≥ 1 phase entière | Choix fournisseur à trancher | **Sous-phase 06.5 dédiée** |
| **C — OR-Tools tournées** | Élevée (régulatrice) | Élevé (microservice Python nouveau, algorithmie) | Élevé | Distance (Haversine×facteur OK en V1, OSRM 2027) | **Sous-phase 06.7 dédiée** |
| **D — Portail B2B** | Faible avant le 1er client (risque de bâtir avant PMF) | Moyen | Élevé (`apps/b2b`, auth, Stripe, isolation tenant) | Validation produit par 1er client payant | **Différé via ADR** |
| **E — Audit RLS + Server Actions + advisors** | Élevée (sécurité données santé, prérequis HDS et 1er client) | Moyen (audit + fixes ciblés, pas de refonte) | ~5-8 h | Aucune | **Phase 06** |
| **F — Dettes CI D1/D2/D3** | Moyenne (débruite la CI, prérequis sérieux pipeline) | Faible | ~2-3 h | Aucune | **Phase 06 — Wave 1** |

- **D-03** — Phase 06 = blocs **A + E + F** (resserrée, ~11-17 h). Incrément cohérent et testable plutôt qu'une méga-phase fourre-tout de 19-32 h.
- **D-04** — HDS = sous-phase **06.5** dédiée. Migration infra à risque (réplication données, RLS, Auth, pg_cron, Vault, Realtime doivent tous suivre). Le choix du fournisseur (Scaleway HDS / OVHcloud HDS / validation Supabase EU + DPA) est tranché dans un discuss propre + ADR. En bêta sans client facturant, Supabase EU sous DPA reste acceptable ; HDS strict = prérequis avant le 1er client payant. Le fournisseur SMS HDS (DEC-062 / ADR-004) rejoint cette trajectoire.
- **D-05** — OR-Tools = sous-phase **06.7** dédiée. Microservice Python OR-Tools (`services/optimizer`) + contrats TS (`packages/optimizer-client`). Distance V1 = Haversine × facteur de correction routier (DEC-056) ; OSRM auto-hébergé avec la géoloc certifiée Assurance maladie (1er janvier 2027). La question OSRM/Haversine est tranchée dans le discuss 06.7.
- **D-06** — Portail B2B = **différé** via ADR jusqu'au 1er client payant validant le produit (anti-construction avant product-market fit). Pas de numéro de phase tant que non déclenché par décision business.

### Périmètre Bloc A — Facturation CGSS PDF

- **D-07** — Le PDF utilise `@react-pdf/renderer` (déjà dans le repo depuis Phase 1.5 pour l'export du registre des traitements). Pas de nouvelle dépendance — DEC-003 respecté. Le skill `pdf` externe n'est pas retenu.
- **D-08** — Contenu du PDF : en-tête société, période, tableau une ligne par course facturable CGSS (date, patient, trajet, distance, décomposition tarif via le moteur 05.5), sous-totaux, total, mentions légales. Conforme à l'esprit des récapitulatifs CPAM.
- **D-09** — Périmètre tarif = celui livré en 05.5 (monopatient, DEC-058). Le PDF **agrège**, il ne recalcule pas. Disclaimer « tarif estimatif » cohérent DEC-061 tant que la télétransmission CGSS n'est pas livrée.

### Périmètre Bloc E — Audit sécurité systémique

- **D-10** — Audit RLS : inventaire des policies de **toutes** les tables métier + matrice rôle × table × action (attendu vs actuel) + migrations correctives + tests pgTAP exhaustifs (isolation cross-org, cross-driver, role escalation).
- **D-11** — Audit Server Actions : inventaire de **toutes** les Server Actions (`grep -rn "'use server'"`), application systématique du pattern DEC-041 (row count check) + du guard `require*` partagé. **DEC-040** (candidate déjà inscrite CONCERNS — guard `require*` obligatoire sur Server Action admin) est **promue LOCKED** dans le cadre de cet audit. Tests E2E error-path (RLS blocking).
- **D-12** — Advisors Supabase (~50, inventaire vérifié par le rédacteur de session) :
  - 3 `function_search_path_mutable` (`set_updated_at`, `unaccent_immutable`, `patient_data_request_set_deadline`) → `SET search_path` (fix simple).
  - `pg_net` dans le schéma `public` → déplacer (schéma `extensions` / `net`).
  - `leaked_password_protection` désactivé → activer (toggle console).
  - ~40 `SECURITY DEFINER` exécutables par `anon` / `authenticated` → **trier** : la majorité sont **légitimes** (triggers audit, fonctions RLS `has_role` / `current_organization_id` / `current_user_role`) — à confirmer et **documenter** ; restreindre `EXECUTE` là où ce n'est pas justifié. Un `SECURITY DEFINER` légitime n'est pas un bug (verrou V7).

### Périmètre Bloc F — Dettes CI V1.5

- **D-13** — Traité en **Wave 1** (avant A et E) pour rendre la CI verte avant le reste de la phase.
  - D1 : `eslint.config.js` flat config pour `@tap/database` et `@tap/shared` (~30 min).
  - D2 : remplacer le SIRET Carrefour Luhn-invalide par un SIRET fictif Luhn-valide dans les tests `@tap/shared` (~15 min).
  - D3 : diagnostic + fix du runner pgTAP CI (suspicion drift `supabase/setup-cli@latest` — pinner une version verte) (~1-2 h).

### Claude's Discretion

- Découpage en waves de Phase 06 au-delà de « F en Wave 1 » : à arbitrer au plan-phase. A et E sont parallélisables.
- Forme exacte de l'UI de déclenchement du PDF (page admin dédiée vs bouton sur une vue existante) : à arbitrer au ui-spec / plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cadrage de phase & méthode
- `.planning/ROADMAP.md` — entrées Phase 06 et Phase 07
- `docs/adr/ADR-003-pivot-e2e-passes-successives.md` — méthode E2E par passes
- `docs/adr/ADR-004-sms-fournisseur-differe.md` — modèle de décision « différer proprement » (à réutiliser pour les ADR B2/CNDA et B2B)
- `CLAUDE.md` § 6 (sécurité RLS / audit), § 9 (tests), § 11 (≤ 300 lignes), § 13.5 (Visible Progress Mandate)

### Facturation (Bloc A)
- `.planning/phases/05.5-pricing-cgss-reel/05.5-SUMMARY.md` — moteur `computeCgssShortTrip` consommé par la facturation
- `.planning/phases/05.5-pricing-cgss-reel/05.5-CONTEXT.md` — grille CNAM 2026, DEC-056..061
- `docs/cahier_des_charges_saas_tap_v2.docx` § 7 — tarification CGSS (périmètre de la facture)
- `.planning/PROJECT.md` — DEC-058 (périmètre monopatient), DEC-061 (disclaimer estimatif)

### Audit sécurité (Bloc E)
- `.planning/codebase/CONCERNS.md` § « Audit RLS systémique reporté Phase 06 HDS »
- `.planning/codebase/CONCERNS.md` § « Server Actions row count check (DEC-041) »
- `.planning/codebase/CONCERNS.md` § « Audit permissions Server Actions modules admin » (contient la candidate DEC-040)
- `.planning/PROJECT.md` — DEC-002 (RLS multi-tenant), DEC-010 (audit_logs), DEC-041 (row count check)
- `docs/adr/ADR-002-supabase-rls-multitenant.md`

### Dettes CI (Bloc F)
- `.planning/VISION.md` § « Stratégie CI/qualité V1.5 → V3 » — D1/D2/D3
- `.planning/codebase/CONCERNS.md` § « Dette CI rouge constante sur main » + § « Dettes CI V1.5 — stratégie acceptée »

### Sous-phases & différés (contexte)
- `.planning/codebase/CONCERNS.md` § « Supabase Cloud non certifié HDS » (06.5)
- `.planning/codebase/CONCERNS.md` § « NIR Edge Function chiffrement 401 » (06.5)
- `.planning/codebase/CONCERNS.md` § « Table prescriptions à créer Phase 06 (RECU-04) »
- `.planning/codebase/CONCERNS.md` § « Items différés Phase 05 / 05.5 → Phase 06 »
- `.planning/PROJECT.md` — CON-001 (architecture portable), DEC-003 (stack figée), DEC-056 (distance Haversine)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@react-pdf/renderer` — déjà utilisé Phase 1.5 (export PDF du registre des traitements) → réutilisable directement pour la facturation CGSS PDF, zéro nouvelle dépendance.
- `packages/pricing` (`computeCgssShortTrip` / `computeCgssFromDistance`) — fonctions pures ; la facturation les consomme pour agréger les montants par course.
- `rides` colonnes pricing (`tarif_amount_eur`, `tarif_source`, décomposition) — données source de la facture.
- Server Action one-shot dirigeant (`recomputeTarifsAction`, `backfillRideGeocodingAction`) — modèle pour une génération PDF / export déclenché manuellement.
- Helpers `@/lib/auth/require-dirigeant`, `@/lib/auth/require-admin-or-regulateur` — à généraliser dans l'audit Server Actions (Bloc E).
- Pattern DEC-041 déjà appliqué à `startRideAction` / `endRideAction` — gabarit du row count check à généraliser.
- Tests pgTAP existants (`supabase/tests/`) — gabarit de l'audit RLS systématique.

### Established Patterns
- DEC-032 — toute migration passe par `cd.yml` `supabase db push` (canal exclusif). Les correctifs RLS / advisors du Bloc E sont des migrations versionnées.
- DEC-013 — couverture 100 % branches sur `packages/pricing` ; la logique d'agrégation de facture, si elle est pure et non triviale, suit la même règle.
- Pattern split client/server des packages workspace (CONCERNS) — à respecter si un nouveau module de facturation est créé.

### Integration Points
- La facturation se branche sur la liste des courses (`/courses`, queries enrichies) et le moteur 05.5.
- L'audit RLS / Server Actions touche transversalement `apps/web/src/app/(admin)/`, `(app)/`, `(driver)/` + `supabase/migrations/` + `supabase/tests/`.
- Les dettes CI touchent `packages/database`, `packages/shared`, `.github/workflows/`.

</code_context>

<specifics>
## Specific Ideas

- Le découpage en sous-phases reprend la numérotation décimale existante du repo (0.7, 1.5, 04.5, 04.7, 04.9, 05.5) : **06.5** pour HDS, **06.7** pour OR-Tools.
- ADR-004 est explicitement cité comme **modèle** pour les ADR de report B2/CNDA et B2B (« différer proprement, sans dette technique »).

</specifics>

<deferred>
## Deferred Ideas

### Sous-phases dédiées à planifier
- **Phase 06.5 — Migration HDS.** Discuss propre + ADR pour le choix fournisseur. Inclut, à confirmer en discuss : NIR Edge Function 401 (infra Edge Function), 2FA TOTP dirigeant, rotation des tokens Supabase (`service_role` → `sb_secret_xxx`, échéance fin 2026), pen test externe.
- **Phase 06.7 — OR-Tools optimisation de tournées.** `services/optimizer` (Python) + `packages/optimizer-client`. Question OSRM vs Haversine tranchée dans son discuss.

### Différés via ADR (pas de phase tant que non déclenchés)
- **Portail B2B multi-tenant commercial** — jusqu'au 1er client payant validant le produit.
- **Télétransmission B2/SEFi via logiciel certifié CNDA + formulaire 606b** — échéance réévaluée selon clients réels.

### Différés hors périmètre Passe 4 resserrée (à reséquencer)
- Table `prescriptions` + RECU-04 (décrément du bon de transport) — petit item autonome, lié aux récurrences ; à folder dans une retouche récurrence ou une mini-PR.
- Tableau de bord de pilotage dirigeant (KPIs) — reporté de Phase 05 ; candidat V2 ou sous-phase dédiée.
- Mode dégradé complet, optimistic UI miroir Dexie, Web Push VAPID, géoloc temps réel — déjà inscrits CONCERNS, hors Passe 4 resserrée.

### Action de séquençage requise
- La ligne Phase 06 de `ROADMAP.md` et l'ajout des entrées 06.5 / 06.7 doivent être formalisés via `/gsd-phase` — non fait dans ce discuss (lecture seule + CONTEXT.md uniquement).

</deferred>

---

## DEC candidates (à acter LOCKED — prochain numéro DEC-063)

- **DEC-063** — Phase 06 resserrée. La Passe 4 brute est redécoupée : Phase 06 = Bloc A (facturation CGSS PDF) + Bloc E (audit RLS / Server Actions + advisors sécurité) + Bloc F (dettes CI D1/D2/D3). Blocs B (HDS) et C (OR-Tools) sortis en sous-phases dédiées 06.5 / 06.7 ; Bloc D (B2B) et la télétransmission B2/CNDA différés via ADR.
- **DEC-064** — Facturation CGSS V1.5 = PDF récapitulatif mensuel (consomme le moteur 05.5, `@react-pdf/renderer`). Télétransmission B2/SEFi/CNDA + formulaire 606b différée : l'échéance du 31 mai 2026 pèse sur le taxi qui télétransmet, pas sur l'éditeur d'un SaaS en bêta sans client facturant. ADR dédié.
- **DEC-065** — Migration HDS = Phase 06.5 dédiée. Choix fournisseur (Scaleway HDS / OVHcloud HDS / validation Supabase EU + DPA) tranché dans le discuss 06.5 + ADR. Supabase EU sous DPA acceptable en bêta ; HDS strict = prérequis 1er client payant. CON-001 architecture portable maintenue.
- **DEC-066** — OR-Tools optimisation de tournées = Phase 06.7 dédiée. Microservice Python OR-Tools + `packages/optimizer-client`. Distance V1 = Haversine × facteur (DEC-056) ; OSRM avec la géoloc certifiée 2027.
- **DEC-067** — Portail B2B multi-tenant commercial différé jusqu'au 1er client payant (anti-construction avant product-market fit). ADR dédié.
- **DEC-040** (déjà candidate, CONCERNS) — promue **LOCKED** pendant l'exécution du Bloc E : guard `require*` partagé obligatoire en tête de toute Server Action admin.

## Success criteria — Phase 06 resserrée

Mesurables / vérifiables :

1. Un PDF récapitulatif mensuel CGSS est généré pour une organisation (en-tête société, période, tableau des courses facturables avec décomposition tarif du moteur 05.5, sous-totaux, total, mentions légales) et téléchargeable depuis l'UI.
2. L'inventaire RLS de toutes les tables métier est documenté (matrice rôle × table × action attendu vs actuel) ; les trous identifiés sont corrigés par migration ; les tests pgTAP cross-org / cross-driver passent en CI.
3. L'inventaire de toutes les Server Actions est documenté ; le pattern DEC-041 (row count check) + le guard `require*` (DEC-040) sont appliqués systématiquement ; les tests E2E error-path (RLS blocking) sont verts.
4. Les ~50 advisors sécurité Supabase sont traités : 3 `function_search_path_mutable` corrigés, `pg_net` déplacé hors `public`, `leaked_password_protection` activé, les `SECURITY DEFINER` triés (légitimes documentés / `EXECUTE` restreint sinon).
5. Les 3 dettes CI D1/D2/D3 sont résolues : Lint vert sur `@tap/database` + `@tap/shared`, test SIRET vert, runner pgTAP vert.
6. Preview Vercel verte, smoke tests Playwright verts, walkthrough script terminé sans erreur (CLAUDE.md § 13.5).

## Dépendances inter-blocs & chemin critique

**Intra-Phase 06 :**
- Bloc F (dettes CI) — sans dépendance → **Wave 1** (rend la CI verte pour le reste).
- Bloc E (audit RLS / SA + advisors) — sans dépendance ; **prérequis de la sous-phase 06.5 HDS** (on ne migre pas une RLS trouée).
- Bloc A (facturation PDF) — dépend du moteur 05.5 (livré) et de `@react-pdf/renderer` (présent). Indépendant de E et F.
- Chemin critique interne : **F → (A ∥ E)**. A et E sont parallélisables.

**Inter-phases :**
- Phase 06 (Bloc E) → **Phase 06.5 HDS** → 1er client payant.
- Phase 06.7 OR-Tools — indépendante de HDS ; peut être planifiée en parallèle.
- B2B + B2/CNDA — conditionnés à l'arrivée d'un client réel payant.

## Estimation révisée

| Périmètre | Estimation |
|---|---|
| Bloc A — facturation CGSS PDF | 4-6 h |
| Bloc E — audit RLS + Server Actions + ~50 advisors | 5-8 h |
| Bloc F — dettes CI D1/D2/D3 | 2-3 h |
| **Phase 06 resserrée (A + E + F)** | **~11-17 h** |
| Sous-phase 06.5 — HDS | à affiner en discuss dédié (migration infra lourde) |
| Sous-phase 06.7 — OR-Tools | à affiner en discuss dédié (~8-15 h) |
| B2B / B2-CNDA | non estimés (différés) |

À comparer à la méga-phase initiale de 19-32 h : le découpage produit un incrément Phase 06 cohérent et testable, et sort la complexité à risque (HDS, OR-Tools) dans des phases dédiées avec leur propre discuss.

## Questions ouvertes à trancher (dirigeant)

Aucune question bloquante restante — les 4 arbitrages centraux (présence de clients réels, périmètre Phase 06, priorité B2B, stratégie HDS) ont été tranchés en discuss. Les questions résiduelles sont déléguées aux discuss des sous-phases :

- **06.5 HDS** — choix du fournisseur (Scaleway / OVHcloud / Supabase EU) et budget associé.
- **06.7 OR-Tools** — distance V1 sur Haversine×facteur vs attendre OSRM.

---

*Phase: 06-facturation-securite-ci*
*Context gathered: 2026-05-20*
