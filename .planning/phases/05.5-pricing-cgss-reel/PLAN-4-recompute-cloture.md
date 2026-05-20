# Plan-4 — Recalcul rétroactif + clôture Phase 05.5

**Phase** : 05.5 Tarif CGSS réel
**Wave** : 4/4
**Dépendances** : Waves 1-3 (moteur réel + grille + UI)
**Estimation** : 1h (vélocité projetée 15-25 min réel)
**Refs** : DEC-060 recalcul + garde-fous, PRIC-04 audit_logs, CLAUDE.md § 13.5

---

## Goal

Livrer le recalcul rétroactif des courses au tarif stub (Server Action dirigeant + garde-fous DEC-060), un E2E Playwright, et clôturer la phase (SUMMARY + ROADMAP + STATE + CONCERNS).

---

## Fichiers à créer / modifier

- `apps/web/src/app/(admin)/admin/maintenance/_components/recompute-tarifs-card.client.tsx` (NEW)
- `apps/web/src/app/(admin)/admin/maintenance/actions.ts` (ÉTENDRE — `recomputeTarifsAction`)
- `apps/web/src/app/(admin)/admin/maintenance/page.tsx` (MODIF — monter la carte)
- `apps/web/e2e/phase-05.5-tarif-cgss.spec.ts` (NEW — E2E pragmatic V1.5)
- `.planning/phases/05.5-pricing-cgss-reel/05.5-SUMMARY.md` (NEW)
- `.planning/ROADMAP.md` (MODIF — Phase 05.5 [x])
- `.planning/STATE.md` (MODIF — completed_phases +1)
- `.planning/codebase/CONCERNS.md` (MODIF — items Phase 06)

---

## `recomputeTarifsAction` — Server Action

```ts
'use server';
// requireDirigeant() — dirigeant only.
// 1. getActiveTariffGrid() — grille de référence du recalcul.
// 2. SELECT rides WHERE organization_id = org
//      AND tarif_source = 'cgss_auto_demo'   (courses au stub)
//      AND statut paiement NON encaissé        (garde-fou DEC-060)
//    — préserve source = 'manual_override' (jamais touché).
// 3. Pour chaque ride : recompute computeCgssShortTrip(input, grid)
//      avec holidays974 (fetch holidays_974).
//      UPDATE rides SET tarif_* = nouveau, tarif_source = 'cgss_auto'
//      .select('id') → DEC-041 row count.
// 4. audit_logs : action 'ride.tarif_recompute', metadata
//      {ride_id, ancien_total, nouveau_total} — PRIC-04.
// 5. return { recomputed: N, preserved_overrides: X, preserved_paid: Y }.
```

> **Garde-fous DEC-060** : skip `source = 'manual_override'`, skip courses encaissées. Le compteur retourné distingue recalculées / préservées (overrides + payées).

> Vérifier en execute les noms exacts des colonnes tarif sur `rides` (Phase 04.7 — `tarif_amount_eur`, `tarif_source`, etc.) + le marqueur d'encaissement (`ride_payments` ou statut).

---

## `RecomputeTarifsCard` — composant client

Carte sur `/admin/maintenance` (UI-SPEC Section 6). Texte explicatif + bouton « Recalculer les tarifs » → `window.confirm` → `recomputeTarifsAction` via `useTransition` → toast + affichage compteur final (« N recalculées · X préservées (Y overrides, Z encaissées) »). Pattern cohérent `backfillRideGeocodingAction` Phase 04.7.

---

## E2E Playwright — pragmatic V1.5

`apps/web/e2e/phase-05.5-tarif-cgss.spec.ts` : 1 test golden path. Recommandation — tester le **simulateur** `/admin/tarifs` (déterministe, pas de dépendance seed courses) :
1. Login dirigeant.
2. `/admin/tarifs` — la carte grille active affiche le forfait.
3. Simulateur : saisir distance + heure → le total se met à jour.
4. Assert un total cohérent affiché.

Si flaky → `test.skip` documenté (cohérent Phase 05 Wave 7).

---

## 05.5-SUMMARY.md

Structure (cohérent `05-SUMMARY.md`) : récap waves + 9 success criteria + 6 DEC-056..061 + patterns + checklist UAT + captures placeholder + items Phase 06 + refs.

---

## Clôture planning

- **ROADMAP** : Phase 05.5 `[ ]` → `[x]` + suffixe livraison.
- **STATE** : `completed_phases` 6 → 7, `completed_plans` +4, percent recalculé.
- **CONCERNS** : section « Items différés Phase 05.5 → Phase 06 » :
  - OSRM auto-hébergé (distance routière réelle, géoloc certifiée 2027)
  - Transport partagé + abattements multi-patients (-23/-35/-37 %)
  - Retour à vide hospitalisation (+25/+50 %)
  - Forfait Grande Ville (non applicable 974 mais à modéliser si extension métropole)
  - Facturation CGSS PDF + télétransmission B2 logiciel CNDA (échéance 31 mai 2026)
  - Formulaire 606b-09/2025
  - Règle exacte majoration nuit « > 50 % du temps de transport »
  - Calibration facteur de correction routier sur cas réels dirigeant

---

## Critères GREEN

- `pnpm typecheck` + `pnpm --filter @tap/web build` PASS.
- `recomputeTarifsAction` préserve overrides + courses encaissées (garde-fous testables).
- E2E simulateur PASS (ou skip documenté).
- ROADMAP/STATE/CONCERNS cohérents.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Recalculer les courses `manual_override` ou encaissées (DEC-060).
- ❌ Skip `audit_logs` (PRIC-04).
- ❌ Skip DEC-041 row count check.
- ❌ Facturation CGSS PDF / B2 / 606b (Phase 06).

---

## Dépendances inter-waves + critical path

```
W1 (fondations data + moteur pur) ──┬──> W2 (PricingBreakdown + intégration)
                                    └──> W3 (page /admin/tarifs)
W2 + W3 ──────────────────────────────> W4 (recalcul + clôture)
```

Critical path : W1 → W3 → W4 (W2 et W3 parallélisables après W1). Total estimé ~5h ROADMAP, projection ~1h30-2h réel agent.
