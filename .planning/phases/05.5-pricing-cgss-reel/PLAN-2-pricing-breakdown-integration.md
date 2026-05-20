# Plan-2 — `PricingBreakdown` enrichi + intégration courses

**Phase** : 05.5 Tarif CGSS réel
**Wave** : 2/4
**Dépendances** : Wave 1 (`PricingResult` enrichie + `computeCgssShortTrip` réel + table `tariff_grids`)
**Estimation** : 1h (vélocité projetée 15-25 min réel)
**Refs** : DEC-061 PricingResult enrichie + disclaimer, DEC-057 grille active, UI-SPEC Surface A + B

---

## Goal

Adapter la Surface A `PricingBreakdown` à la décomposition réelle (retrait badge DEMO + bandeau `fallback_random`, ajout lignes forfait/km/DROM/TPMR/majoration + disclaimer estimatif) et threader la grille active BDD jusqu'aux consommateurs du calcul tarif.

---

## Fichiers à créer / modifier

- `apps/web/src/app/(app)/courses/_components/pricing-breakdown.client.tsx` (ÉTENDRE)
- `apps/web/src/app/(app)/courses/_components/override-tarif-modal.client.tsx` (VÉRIFIER — delta minimal)
- `apps/web/src/lib/pricing/get-active-tariff-grid.ts` (NEW — helper fetch grille active)
- Consommateurs du pricing (à identifier en wave execute) : là où `computeCgssShortTrip` est appelé — threader la grille active.

---

## Helper — grille active

```ts
// apps/web/src/lib/pricing/get-active-tariff-grid.ts
import 'server-only';
import type { TariffGrid } from '@tap/pricing';
import { createClient } from '@/lib/supabase/server';

/**
 * Grille active = celle dont date_effet est la plus récente ≤ aujourd'hui
 * pour l'organisation. Lecture server-side (Server Component / Action).
 */
export async function getActiveTariffGrid(): Promise<TariffGrid | null> {
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const res = await supabase
    .from('tariff_grids')
    .select(
      'forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, ' +
        'supplement_tpmr_eur, majoration_pct, facteur_correction_routier, arrondi_eur',
    )
    .lte('date_effet', today)
    .order('date_effet', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (res.data as TariffGrid | null) ?? null;
}
```

> RLS `tariff_grids_select_org` scope déjà à l'organisation — pas de `.eq('organization_id', ...)` nécessaire (cohérent pattern existant).

---

## Surface A — `PricingBreakdown` deltas

Suivre UI-SPEC Section 3.

**Retraits** :
- Badge `DEMO` (`<span>...DEMO</span>`).
- Bandeau `isFallback` / `fallback_random` (la source random n'existe plus).

**Ajouts** (lignes `<dl>` conditionnelles) :

| Ligne | Condition | Format |
|-------|-----------|--------|
| Forfait prise en charge | toujours | `forfait_eur` — mention « (N km inclus) » |
| Distance / km facturés | `distance_km !== null` | `X,X km · Y,Y km facturés × Z,ZZ €/km` → `km_total_eur` |
| Distance non disponible | `distance_km === null` | « Distance non disponible — forfait seul » |
| Supplément DROM | `supplement_drom_eur > 0` | `+ X,XX €` |
| Supplément TPMR | `supplement_tpmr_eur > 0` | `+ XX,XX €` |
| Majoration | `majoration_eur > 0` | label dynamique selon `majoration_motif` |
| Total | toujours | `font-mono tabular-nums` + bouton Modifier si `editable` |
| Disclaimer | toujours | icône `Info`, `text-xs text-muted-foreground` |

**Label majoration dynamique** :
```
majoration_motif === 'nuit'    → « Majoration nuit (+50 %) »
majoration_motif === 'weekend' → « Majoration week-end (+50 %) »
majoration_motif === 'ferie'   → « Majoration jour férié (+50 %) »
```

**Disclaimer** (DEC-061) :
```
« Tarif estimatif, non contractuel jusqu'à la facturation CGSS.
  Distance estimée (vol d'oiseau corrigé). »
```

**Props** : interface `Props` inchangée (`pricing: PricingResult`, `editable?`, `onOverride?`) — seul le type `PricingResult` change (Wave 1).

---

## Surface B — `OverrideTarifModal` vérification

Delta attendu **minimal**. Le modal force `total_eur` manuel + motif. Vérifier :
- Le récap « tarif calculé » (s'il existe) lit bien `pricing.total_eur` (champ conservé).
- `SOURCE_LABEL` reste cohérent (`manual_override` préservé par recalcul DEC-060).

Si aucun usage de champs supprimés (`majo_nuit_eur`, `supp_tpmr_eur` anciens noms) → aucune modification. Sinon adapter aux nouveaux noms (`majoration_eur`, `supplement_tpmr_eur`).

---

## Threading grille active

Les consommateurs qui appellent `computeCgssShortTrip` doivent désormais fournir la grille (Wave 1 = signature à 2 paramètres). En wave execute :
1. Identifier les call-sites (`grep computeCgssShortTrip apps/web`).
2. Chaque call-site server-side : `const grid = await getActiveTariffGrid()`.
3. Si `grid === null` (aucune grille seedée) : fallback gracieux — afficher « grille tarifaire non configurée » plutôt que crash.
4. Passer `holidays974` (Set YYYY-MM-DD) — réutiliser le fetch `holidays_974` (pattern Phase 05 `useHolidays974` / fetch server).

---

## Critères GREEN

- `pnpm typecheck` workspace PASS (tous les call-sites threadés).
- `pnpm --filter @tap/web build` PASS (leçon hotfix #134 — build obligatoire).
- `PricingBreakdown` : zéro occurrence « DEMO », disclaimer présent.
- Smoke : une course avec coords affiche la décomposition réelle.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Garder le badge DEMO (DEC-061).
- ❌ Réécrire `PricingBreakdown` from scratch (étendre).
- ❌ Hardcoder la grille côté composant (toujours via `getActiveTariffGrid`).
- ❌ Afficher les lignes nulles (« 0,00 € » bruyant).
- ❌ framer-motion (NFR-004).
