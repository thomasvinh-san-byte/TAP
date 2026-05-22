# PLAN-2 — Wave 2 : Page, redirection, états + clôture

**Phase** : 06.8 Tableau de bord dirigeant
**Wave** : 2/2 — assemblage + câblage + clôture.
**Dépendances** : PLAN-1 mergé (`queries-dashboard.ts`, `KpiCard`, `ComplianceCard`).
**Estimation** : 4-6 h.
**Refs** : `06.8-CONTEXT.md` (D-01, D-02, D-03, D-11), `06.8-UI-SPEC.md` (§2 layout, §6 états, §9 WCAG), `CLAUDE.md` §9 / §11 / §13.5.

---

## Goal

Assembler la page d'accueil de pilotage à partir des briques de la Wave 1, la câbler (redirection par rôle + nav), gérer ses états, puis clôturer la phase.

---

## Livrable 1 — Page `/tableau-de-bord`

- `apps/web/src/app/(app)/tableau-de-bord/page.tsx` (NEW) — Server Component, `requireDirigeantPage()` en tête (D-02 — un régulateur/chauffeur forçant l'URL est redirigé). Appelle `queries-dashboard.ts`, rend la grille en **pyramide inversée** (UI-SPEC §2) :
  - En-tête : titre `Tableau de bord` (`h1`) + sous-titre + période courante (mois calendaire fixe V1, pas de sélecteur).
  - Bloc « À traiter » (`h2`) : 2 `KpiCard` (Courses à facturer variante `simple` + lien `/admin/facturation` ; Alertes variante `alerte`).
  - Bloc « Activité » (`h2`) : 4 `KpiCard` (CA `ventilation`, Volume `multi`, No-show/annulation `simple` à seuil, Chauffeurs `simple`).
  - `ComplianceCard` pleine largeur en pied.
  - Grille CSS simple responsive (4 → 2 → 1 colonnes). Rendu **au chargement** (D-03 — aucune souscription temps réel).
- `apps/web/src/app/(app)/tableau-de-bord/loading.tsx` (NEW) — skeleton de la grille (`ui/skeleton`) ; jamais de page blanche.

---

## Livrable 2 — Redirection par rôle + navigation (D-01)

- `apps/web/src/app/page.tsx` (MODIFY) — remplacer le `redirect('/patients')` uniforme par une redirection selon `profiles.role` : `dirigeant` → `/tableau-de-bord`, `regulateur` → `/cockpit`, `chauffeur` → `/conduite`, non authentifié / rôle inconnu → `/login`. Reste un Server Component.
- `apps/web/src/lib/nav-config.ts` (MODIFY) — ajouter `{ href: '/tableau-de-bord', label: 'Tableau de bord' }` **en tête** de `DIRIGEANT_TABS`. `REGULATEUR_TABS` inchangé (D-02 — le régulateur ne voit pas l'onglet).

---

## Livrable 3 — États de la page (UI-SPEC §6)

- **Chargement** : `loading.tsx` (Livrable 1).
- **Vide / début d'activité** : une agrégation à 0 → message d'amorçage neutre dans la carte (« Aucune course ce mois ») plutôt qu'un « 0 » sec. KPI Alertes vide → état vert « Aucune alerte ».
- **Erreur** : si une agrégation échoue, la carte concernée affiche un message sobre (« Indicateur indisponible ») **sans casser le reste de la page** — les helpers de `queries-dashboard.ts` renvoient des valeurs de repli (pattern des helpers existants qui renvoient `[]` / `0` sur erreur), la page reste rendue.

---

## Livrable 4 — Checklist WCAG 2.2 AA (UI-SPEC §9 — appliquée à la page)

- Hiérarchie de titres `h1` (page) / `h2` (blocs) / `h3` (cartes) ; HTML sémantique.
- Contraste ≥ 4,5:1 ; tout état couleur doublé d'un texte.
- Navigation clavier complète, anneau de focus visible ; cibles ≥ 44 px.
- `prefers-reduced-motion` honoré ; aucune animation non essentielle.
- Test du flou : bloc « À traiter » et valeurs principales identifiables à 10 % de résolution.

---

## Livrable 5 — E2E golden path

`apps/web/tests/e2e/phase-06.8-tableau-bord.spec.ts` (NEW) — test canonique (CLAUDE.md §9 — 1 E2E golden path) :
1. Login démo dirigeant.
2. Vérifier l'atterrissage automatique sur `/tableau-de-bord` (redirection par rôle).
3. Vérifier la présence du titre, des blocs « À traiter » et « Activité », des 6 cartes-KPI et de la carte Conformité.
4. Cliquer le lien « Facturer » de la carte Courses à facturer → arrive sur `/admin/facturation`.
5. (Optionnel) login démo régulateur → atterrit sur `/cockpit`, pas sur le dashboard.

Smoke preview : **vérifier / adapter `tests/smoke/preview.spec.ts`** si l'un de ses scénarios suppose que le dirigeant atterrit sur `/patients` — la redirection par rôle change la page d'accueil dirigeant.

---

## Livrable 6 — Clôture

- `06.8-SUMMARY.md` — récap des 2 waves, success criteria cochés, walkthrough script, captures Visible Progress.
- `ROADMAP.md` — Phase 06.8 cochée `[x]` + suffixe de livraison + `Status: Complete`.
- `STATE.md` — `completed_phases` / `completed_plans` incrémentés ; prochaine étape.
- `CONCERNS.md` — l'item « dashboard global » est **résolu** (Phase 06.8 livrée) ; reporter les pistes différées : ponctualité on-time (si un horodatage de prise en charge réel est introduit), taux d'utilisation flotte (si véhicule-heures), graphes de tendance (V2).
- `PROJECT.md` — DEC-071, DEC-072, DEC-073 (candidates du discuss) promues LOCKED.
- `docs/showcase/06.8-tableau-bord-dirigeant/` — dossier + `.gitkeep`.

---

## Approche test (CLAUDE.md §9)

Pas de table nouvelle (pas de pgTAP), pas de Vitest sur queries/composants. Preuve canonique = E2E golden path (Livrable 5) + smoke preview + revue visuelle.

---

## Critères de complétion (GREEN)

- À la connexion, le dirigeant atterrit sur `/tableau-de-bord` ; le régulateur sur `/cockpit` ; le chauffeur sur `/conduite`.
- `/tableau-de-bord` (dirigeant uniquement) affiche les 6 KPIs + la carte Conformité en pyramide inversée ; chiffres monétaires cohérents avec Caisse/Facturation.
- Les KPIs Action mènent par lien à leur page d'action ; le taux de no-show affiche son seuil.
- États skeleton / vide / erreur fonctionnels ; une carte en erreur n'effondre pas la page.
- Onglet « Tableau de bord » en tête de la nav dirigeant.
- E2E `phase-06.8-tableau-bord` vert ; smoke preview vert (adapté si besoin).
- `pnpm typecheck` PASS, `pnpm --filter @tap/web build` PASS, `lint` vert. Fichiers ≤ 300 LOC, composants ≤ 150 LOC.
- `06.8-SUMMARY.md` rédigé ; ROADMAP `[x]` ; DEC-071..073 LOCKED.

---

## Risques + mitigations

- **Smoke test preview** : la redirection par rôle modifie la page d'accueil du dirigeant — si `preview.spec.ts` attend le dirigeant sur `/patients`, l'adapter (atterrissage `/tableau-de-bord`).
- **`requireDirigeantPage` redirige le régulateur vers `/admin/chauffeurs`** : sans incidence — la redirection par rôle de `app/page.tsx` fait que le régulateur n'atteint jamais `/tableau-de-bord` par le flux normal.
- **Cohérence des chiffres** : garantie par PLAN-1 (réutilisation des helpers + `monthBounds`) — ne pas réintroduire de requête monétaire dans la page.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Rendre le dashboard accessible au régulateur (D-02).
- ❌ Souscription temps réel / `postgres_changes` (D-03 — rendu au chargement).
- ❌ Réintroduire une requête monétaire dans la page au lieu de `queries-dashboard.ts` (D-04).
- ❌ Bento grid, graphes lourds, nouvelle dépendance (D-09 / D-11).
- ❌ Page blanche au chargement (skeleton obligatoire).
- ❌ framer-motion (NFR-004).
- ❌ Marquer la phase complète sans build vert (CLAUDE.md §13.5).
- ❌ Test Vitest sur queries/composants (CLAUDE.md §9).
