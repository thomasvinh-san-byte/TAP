# Plan-3 — Page admin `/admin/tarifs`

**Phase** : 05.5 Tarif CGSS réel
**Wave** : 3/4
**Dépendances** : Wave 1 (`tariff_grids` + `computeCgssShortTrip` pour le simulateur)
**Estimation** : 1.5h (vélocité projetée 25-35 min réel)
**Refs** : DEC-057 versionnement, DEC-041 row count check, PRIC-04 audit_logs, UI-SPEC Surface C

---

## Goal

Créer la page admin dirigeant-only `/admin/tarifs` : carte grille active + simulateur live + table historique des versions + édition (INSERT nouvelle version). Parallélisable avec Wave 2 (territoires disjoints).

---

## Fichiers à créer

```
apps/web/src/app/(admin)/admin/tarifs/
  page.tsx                                       # Server Component
  actions.ts                                     # saveTariffGridAction
  _components/
    tariff-grid-card.client.tsx                  # carte grille active
    tariff-simulator.client.tsx                  # simulateur live useMemo
    tariff-history-table.client.tsx              # table versions
    tariff-edit-sheet.client.tsx                 # édition = INSERT version
```

Modif : `apps/web/src/app/(admin)/layout.tsx` ou nav admin — ajouter l'onglet `/admin/tarifs`.

---

## `page.tsx` — Server Component

```tsx
// Guard requireDirigeantPage (cohérent /admin/sms-templates).
// Fetch :
//   - grilles : SELECT * FROM tariff_grids ORDER BY date_effet DESC
//   - grille active = première dont date_effet <= today
// Passe { grids, activeGrid } aux composants client.
export default async function TarifsPage() {
  await requireDirigeantPage();
  const supabase = createClient();
  const { data } = await supabase
    .from('tariff_grids')
    .select('*')
    .order('date_effet', { ascending: false });
  const grids = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const activeGrid = grids.find((g) => g.date_effet <= today) ?? null;
  // render : TariffGridCard(activeGrid) + TariffSimulator(activeGrid)
  //          + TariffHistoryTable(grids, activeGrid.id)
}
```

---

## `TariffGridCard` — carte grille active

Affichage label↔valeur (UI-SPEC Section 5). Lignes : forfait, km inclus, prix km 974, supplément DROM, supplément TPMR, majoration %, facteur correction. Mention « En vigueur depuis le {date_effet} ». Bouton « Modifier la grille » → ouvre `TariffEditSheet`. `font-mono tabular-nums` montants.

Si `activeGrid === null` : état vide « Aucune grille configurée » + CTA créer.

---

## `TariffSimulator` — simulateur live

```
État local : distance_km (number), heure (HH:MM), tpmr (boolean).
useMemo([distance, heure, tpmr, activeGrid]) :
  construit un PricingInput synthétique :
    - coords : non fournies — on injecte directement distance_km via
      un mode « simulateur » OU on calcule depuis distance saisie.
    NOTE : computeCgssShortTrip prend des coords. Pour le simulateur,
    deux options (à trancher en execute) :
      (a) exposer une variante computeFromDistance(distance, ...) pure
      (b) générer 2 coords synthétiques séparées de `distance` km
    → Recommandation : (a) — extraire le cœur de calcul en fonction
      computeCgssFromDistance(distanceKm | null, input, grid) que
      computeCgssShortTrip appelle après le Haversine. Le simulateur
      réutilise computeCgssFromDistance directement. Reste 100% pure.
  rend la décomposition (réutilise la logique d'affichage Surface A).
Pas de bouton « Calculer » (recalcul live).
NFR-001 : aucune donnée patient — entrées numériques pures.
```

> **Impact Wave 1** : si l'option (a) est retenue, PLAN-1 doit exposer `computeCgssFromDistance`. À acter en execute Wave 1 OU petit ajustement Wave 3. Recommandation : extraire dès Wave 1 (fonction interne déjà nécessaire).

---

## `TariffHistoryTable` — table versions

Table dense (lignes `h-10` 40px, cohérent cockpit Phase 05). Colonnes : date d'effet, forfait, km 974, DROM, TPMR, majo, statut (Active / Archivée). Tri date d'effet desc. La ligne active surlignée discrètement (`bg-muted/30`), badge « Active » `text-emerald-700`.

---

## `TariffEditSheet` — édition = INSERT nouvelle version

Sheet latéral (pattern `OverrideTarifModal`). Champs : forfait, km inclus, prix km, DROM, TPMR, majo %, facteur correction, **date d'effet** (input date, défaut = demain). Submit → `saveTariffGridAction`.

Si le composant approche 300 LOC (CLAUDE.md § 11) → extraire les champs en `tariff-grid-fields.client.tsx`.

---

## `saveTariffGridAction` — Server Action

```ts
'use server';
// Zod : forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur,
//   supplement_tpmr_eur, majoration_pct, facteur_correction_routier,
//   arrondi_eur, date_effet (regex YYYY-MM-DD).
// requireDirigeant() — dirigeant only (RLS BDD double rideau).
// INSERT tariff_grids (nouvelle version — JAMAIS update, DEC-057).
//   .select('id') → DEC-041 row count check (1 attendu).
//   Conflit unique (organization_id, date_effet) → message clair
//     « une grille existe déjà à cette date d'effet ».
// audit_logs : action 'tariff_grid.create', metadata {date_effet,
//   prix_km_eur, ...} — PRIC-04.
// revalidatePath('/admin/tarifs').
```

---

## Critères GREEN

- `pnpm typecheck` workspace PASS.
- `pnpm --filter @tap/web build` PASS.
- `/admin/tarifs` accessible dirigeant, refuse régulateur (redirect).
- Simulateur recalcule live sans bouton.
- Édition crée une nouvelle ligne `tariff_grids` (vérifiable historique).
- Chaque fichier ≤ 300 LOC.

---

## Anti-patterns / NE PAS FAIRE

- ❌ UPDATE d'une grille existante (DEC-057 — INSERT version uniquement).
- ❌ Hardcoder les valeurs par défaut tarifaires côté composant.
- ❌ Bouton « Calculer » dans le simulateur (live `useMemo`).
- ❌ Noms propres dans le simulateur (NFR-001).
- ❌ Skip `requireDirigeant` / DEC-041 row count check.
- ❌ framer-motion (NFR-004).
