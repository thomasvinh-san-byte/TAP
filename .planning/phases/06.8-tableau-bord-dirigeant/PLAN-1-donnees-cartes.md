# PLAN-1 — Wave 1 : Données + composants de carte (briques de base)

**Phase** : 06.8 Tableau de bord dirigeant
**Wave** : 1/2 — les briques. Prérequis de la Wave 2.
**Dépendances** : aucune. `main` = #169.
**Estimation** : 4-5 h.
**Refs** : `06.8-CONTEXT.md` (D-04, D-05, D-06, D-09, D-10, D-11), `06.8-UI-SPEC.md` (§3 anatomie carte, §4 KPIs, §5 conformité), `CLAUDE.md` §9 / §11.

---

## Note de découpage — réordonnancement justifié

Le brief proposait W1 = données + page, W2 = cartes. Mais **la page du dashboard ne peut pas se rendre sans ses cartes** — données et page seules ne forment pas un livrable cohérent. Découpage retenu : **W1 = les briques feuilles** (couche de données + composants de carte, indépendants et assemblables), **W2 = la page** qui les compose + redirection + nav + clôture. Ordre de dépendance naturel, chaque wave est un incrément cohérent.

---

## Goal

Livrer les deux briques que la Wave 2 assemble :
1. **`queries-dashboard.ts`** — les 6 agrégations mensuelles, **réutilisant** les définitions de Caisse et Facturation pour que les chiffres soient identiques (D-04).
2. **`KpiCard`** + **`ComplianceCard`** — les composants de présentation (cartes), purement visuels, sans dépendance à la page.

---

## Livrable 1 — `queries-dashboard.ts` (le cœur)

`apps/web/src/app/(app)/tableau-de-bord/_lib/queries-dashboard.ts` (NEW) — `import 'server-only'`, pattern miroir de `queries-caisse.ts` / `queries-facturation.ts`. RLS scope par `organization_id`.

### Réutilisation des bornes de période (anti-divergence — D-06)

- `monthBounds(mois)` de `queries-facturation.ts` est aujourd'hui une **fonction locale**. PLAN-1 l'**exporte** (`export function monthBounds`) pour que `queries-dashboard.ts` l'importe — bornes UTC identiques, aucun recalcul divergent. Modification minime de `queries-facturation.ts` (ajout du mot-clé `export`), comportement inchangé.

### Les 6 agrégations — réutilisation KPI par KPI

| KPI | Donnée | Réutilisation |
|---|---|---|
| **1 — Courses à facturer** | `getCoursesFacturables(moisCourant).length` | **Réutilise** le helper de `queries-facturation.ts` tel quel. |
| **2a — Factures incomplètes** | `getCountCoursesSansTarif(moisCourant)` | **Réutilise** le helper de `queries-facturation.ts` tel quel. |
| **2b — No-shows 7 j** | count `rides` `no_show_at >= now-7j` | Nouveau count simple (pas de définition monétaire à faire diverger). |
| **3 — CA du mois + ventilation** | total + `by_method` des courses encaissées du mois | **Réutilise la définition `CaisseTotals`** : mêmes critères que `listRidesEncaissees` (`status='terminee'` + `payment_status='encaisse'`, ventilation `by_method`), appliqués sur les bornes **mensuelles** (`monthBounds`) au lieu d'une journée. Le type `CaisseTotals` est réutilisé. La logique « encaissé » n'est **pas** redéfinie. |
| **4 — Volume de courses** | count `rides` aujourd'hui / semaine / mois | Counts par fenêtre temporelle sur `rides`. |
| **5 — Taux no-show / annulation** | (`no_show_at` non null + `status` ∈ `annulee_*`) ÷ total du mois | Counts par `ride_status` sur le mois. |
| **6 — Activité chauffeurs** | nb chauffeurs avec ≥ 1 course aujourd'hui / total actifs + moyenne courses/chauffeur | `drivers` (actifs) + `rides` du jour groupées par `driver_id`. |

**Contrainte de cohérence (D-04 / verrou V2)** : les chiffres monétaires (KPI 1, 2a, 3) doivent être **identiques au centime** à ceux des pages Caisse et Facturation → réutiliser les helpers et leurs critères, jamais réécrire une requête monétaire. Les counts de statut (2b, 4, 5, 6) n'ont pas de contrepartie Caisse/Facturation — ce sont des comptes directs sur `rides` / `drivers`.

Le module expose un type `DashboardData` agrégeant les 6 résultats + les compteurs de conformité (counts des tables `legal` : `data_processing_register`, `dpa_record`, `dpia_record` + dernière `updated_at`).

---

## Livrable 2 — `KpiCard` (composant de carte réutilisable)

`apps/web/src/app/(app)/tableau-de-bord/_components/kpi-card.tsx` (NEW) — conforme à l'anatomie UI-SPEC §3. Conteneur `rounded-lg border bg-background p-16` (pas de primitive `Card` dans le repo).

- **Structure** : libellé (`h3`) + valeur principale (`text-2xl`/`3xl font-semibold tabular-nums`) + ligne de contexte grise + état couleur optionnel + lien d'action optionnel.
- **4 variantes** (prop `variant` ou sous-composants, au choix de l'exécution, chaque fichier ≤ 150 LOC) :
  - `simple` — libellé + valeur + contexte (+ lien).
  - `ventilation` — valeur principale + petite liste libellé/montant alignée à droite (`tabular-nums`).
  - `multi` — 3 lignes Aujourd'hui / Semaine / Mois.
  - `alerte` — liste courte de lignes cliquables ; rendu vert « Aucune alerte » si vide.
- **WCAG (D-11)** : tout état couleur doublé d'un texte ; lien focusable au clavier, anneau de focus visible ; cibles ≥ 44×44 px ; pas d'animation (NFR-004).
- Composant **purement présentationnel** : reçoit ses valeurs en props, aucune query, aucune logique métier.

---

## Livrable 3 — `ComplianceCard` (carte conformité factuelle — D-10)

`apps/web/src/app/(app)/tableau-de-bord/_components/compliance-card.tsx` (NEW).

- Affiche des **compteurs documentaires factuels** : « Registre : N traitements · DPA : N fiches · DPIA : brouillon / aucune · Dernière mise à jour : JJ/MM/AAAA » + lien « Gérer → » vers `/admin/legal`.
- Section vide indiquée factuellement (« DPIA : aucune ») — sans rouge, sans croix, sans injonction.
- **Interdit** : feu vert, « conforme RGPD », score, coche de validation, état rouge/vert. Couleur **neutre uniquement** (un état couleur serait lu comme un verdict — verrou V4).
- Présentationnel : reçoit les compteurs en props.

---

## Approche test (CLAUDE.md §9)

- **Aucun test unitaire.** Pas de table nouvelle → pas de pgTAP. `queries-dashboard.ts` est un module de requêtes serveur — §9 exclut le Vitest sur les queries. `KpiCard` / `ComplianceCard` sont des composants de présentation — §9 exclut le Vitest sur les composants React.
- La cohérence des chiffres et le rendu sont couverts par l'**E2E golden path de la Wave 2** + la revue visuelle sur preview.

---

## Critères de complétion (GREEN)

- `monthBounds` exporté depuis `queries-facturation.ts` (comportement inchangé).
- `queries-dashboard.ts` expose `DashboardData` ; KPIs 1/2a/3 réutilisent les helpers/définitions existants ; KPIs 2b/4/5/6 sont des counts directs.
- `KpiCard` rend les 4 variantes ; états couleur doublés de texte ; lien focusable.
- `ComplianceCard` affiche des compteurs factuels + lien, aucun verdict ni état couleur.
- `pnpm typecheck` PASS, `pnpm --filter @tap/web build` PASS. Fichiers ≤ 300 LOC, composants ≤ 150 LOC.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Réécrire une requête monétaire au lieu de réutiliser `getCoursesFacturables` / `getCountCoursesSansTarif` / la définition `CaisseTotals` (D-04 / V2).
- ❌ Recalculer des bornes de période divergentes — réutiliser `monthBounds` (D-06).
- ❌ `ComplianceCard` avec feu vert / score / verdict (D-10 / V4).
- ❌ Mettre de la logique de query dans les composants de carte (présentationnel only).
- ❌ Graphes lourds, lib de graphes, nouvelle dépendance (D-09 / V7).
- ❌ Spécifier une carte ponctualité / flotte (D-07 / D-08 — hors V1).
- ❌ Test Vitest sur les queries ou les composants (CLAUDE.md §9).
