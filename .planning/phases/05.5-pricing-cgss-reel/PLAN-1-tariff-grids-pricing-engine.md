# Plan-1 — Migration `tariff_grids` + moteur pricing réel

**Phase** : 05.5 Tarif CGSS réel
**Wave** : 1/4
**Dépendances** : aucune (démarre direct — critical path)
**Estimation** : 1.5h (vélocité projetée 25-35 min réel)
**Refs** : DEC-056 Haversine×facteur, DEC-057 grille BDD versionnée, DEC-058 monopatient, DEC-059 majoration Indian/Reunion, DEC-061 PricingResult enrichie, DEC-013 100% branches, DEC-032 CD push exclusif

---

## Goal

Poser les fondations data + logique pure : migration `tariff_grids` versionnée (seed grille 974 active) + `computeCgssShortTrip` RÉEL (remplace le stub DEC-042) testé 100% branches Vitest. ZÉRO UI cette wave (cohérent Phase 05 Wave 1).

---

## Fichiers à créer / modifier

### Migration BDD (1)
- `supabase/migrations/20260522000001_tariff_grids.sql` (NEW)

### packages/pricing (modifs)
- `packages/pricing/src/compute-cgss-short-trip.ts` (RÉÉCRITURE — remplace le stub)
- `packages/pricing/src/__tests__/compute-cgss-short-trip.test.ts` (RÉÉCRITURE)
- `packages/pricing/package.json` (script `test` → `vitest run --coverage`)
- `packages/pricing/src/index.ts` (vérifier exports enrichis)

---

## Schéma migration `tariff_grids`

```sql
-- Phase 05.5 Wave 1 — Grille tarifaire CGSS versionnée (DEC-057)
-- Convention-cadre nationale CNAM/taxi applicable 2026.
-- Tarif km 974 + supplément DROM en BDD (volatilité conflit local 974) —
-- jamais hardcodés dans le code (DEC-057).

create table public.tariff_grids (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date_effet date not null,
  forfait_eur numeric(6,2) not null,
  km_inclus integer not null,
  prix_km_eur numeric(6,2) not null,
  supplement_drom_eur numeric(6,2) not null,
  supplement_tpmr_eur numeric(6,2) not null,
  majoration_pct integer not null,
  facteur_correction_routier numeric(4,2) not null,
  arrondi_eur numeric(4,2) not null default 0.05,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, date_effet)
);

-- Index « grille active » : MAX(date_effet) <= today par org.
create index tariff_grids_org_date_effet_idx
  on public.tariff_grids (organization_id, date_effet desc);

alter table public.tariff_grids enable row level security;

-- SELECT : régulateur + dirigeant de l'organisation.
create policy tariff_grids_select_org on public.tariff_grids
  for select to authenticated
  using (organization_id = (select public.current_organization_id()));

-- INSERT : dirigeant uniquement (édition = nouvelle version DEC-057).
create policy tariff_grids_insert_dirigeant on public.tariff_grids
  for insert to authenticated
  with check (
    organization_id = (select public.current_organization_id())
    and public.has_role('dirigeant'::public.user_role)
  );

-- Pas d'UPDATE / DELETE : versionnement strict (chaque changement = INSERT).

-- Seed grille 974 active — convention en vigueur 1er nov 2025.
-- updated_by null = seed système (le dirigeant prend le relai au 1er edit).
insert into public.tariff_grids (
  organization_id, date_effet, forfait_eur, km_inclus, prix_km_eur,
  supplement_drom_eur, supplement_tpmr_eur, majoration_pct,
  facteur_correction_routier, arrondi_eur
)
select id, '2025-11-01', 13.00, 4, 1.22, 3.00, 30.00, 50, 1.40, 0.05
from public.organizations;
```

> **DEC-032** : migration appliquée AUTOMATIQUEMENT au merge via `cd.yml` (PAS via MCP `apply_migration`). Le job `sync-types` régénère `types.gen.ts` post-merge.

> **Note seed multi-org** : le `insert ... select` seede une grille pour chaque organisation existante. V1.5 mono-régie = 1 org = 1 grille seed.

---

## Signatures TypeScript — `computeCgssShortTrip` réel

```ts
// La grille est passée en PARAMÈTRE (DEC-057) → fonction pure, testable
// 100% branches sans BDD. Aucune valeur tarifaire hardcodée.

export interface TariffGrid {
  forfait_eur: number;
  km_inclus: number;
  prix_km_eur: number;
  supplement_drom_eur: number;
  supplement_tpmr_eur: number;
  majoration_pct: number;
  facteur_correction_routier: number;
  arrondi_eur: number;
}

export type TransportMode = 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';
export type DistanceMethod = 'haversine_corrige' | 'unavailable';
export type MajorationMotif = 'nuit' | 'weekend' | 'ferie' | null;

export interface PricingInput {
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  scheduled_at: string;          // ISO timestamp
  transport_mode: TransportMode;
  /** YYYY-MM-DD des jours fériés 974 (table holidays_974, DEC-059). */
  holidays974: Set<string>;
}

export interface PricingResult {
  forfait_eur: number;
  distance_km: number | null;            // distance routière corrigée
  distance_method: DistanceMethod;
  km_factures: number | null;            // km au-delà de km_inclus
  prix_km_eur: number | null;
  km_total_eur: number | null;
  supplement_drom_eur: number;
  supplement_tpmr_eur: number;
  majoration_pct: number;
  majoration_motif: MajorationMotif;
  majoration_eur: number;
  total_eur: number;
}

export function computeCgssShortTrip(
  input: PricingInput,
  grid: TariffGrid,
): PricingResult;
```

---

## Pseudo-code — points délicats

### Distance (DEC-056)

```
si les 4 coords présentes :
  haversine = haversineKm(pickup, dropoff)
  distance_km = haversine × grid.facteur_correction_routier
  distance_method = 'haversine_corrige'
sinon :
  distance_km = null ; distance_method = 'unavailable'
```

### Km facturés (DEC-058 — forfait inclut km_inclus)

```
si distance_km !== null :
  km_factures = max(0, distance_km - grid.km_inclus)
  km_total_eur = roundTo(km_factures × grid.prix_km_eur, grid.arrondi_eur)
sinon :
  km_factures = null ; km_total_eur = null
```

### Majoration non-cumulable (DEC-059)

```
// heure locale Réunion — CORRIGE le bug stub getUTCHours.
// Utiliser Intl.DateTimeFormat timeZone 'Indian/Reunion' OU
// décalage fixe +4h (Réunion sans DST).
date_locale = scheduled_at converti Indian/Reunion
iso_jour = YYYY-MM-DD de date_locale

motif = null
si iso_jour ∈ holidays974          → motif = 'ferie'
sinon si dimanche                  → motif = 'weekend'
sinon si samedi && heure >= 12     → motif = 'weekend'
sinon si heure >= 20 || heure < 8  → motif = 'nuit'
// une seule majoration max (priorité férié > weekend > nuit)

majoration_pct = motif ? grid.majoration_pct : 0
base_majorable = forfait + km_total_eur + drom + tpmr
majoration_eur = motif
  ? roundTo(base_majorable × majoration_pct / 100, grid.arrondi_eur)
  : 0
```

### Total

```
total_eur = roundTo(forfait + km_total_eur + drom + tpmr + majoration_eur,
                    grid.arrondi_eur)
```

### Suppléments

```
supplement_drom_eur = grid.supplement_drom_eur          // toujours (974)
supplement_tpmr_eur = transport_mode === 'tpmr'
  ? grid.supplement_tpmr_eur : 0
```

---

## Tests Vitest — 100% branches (DEC-013, PRIC-03)

`vitest.config.ts` a déjà `thresholds.branches: 100` + `TZ: Indian/Reunion`. Passer le script `test` à `vitest run --coverage` (sinon le seuil n'est pas appliqué).

Cas de test couvrant 100% branches :
1. Trajet jour, monopatient, coords présentes → forfait + km + DROM.
2. Trajet > km_inclus → km_factures > 0.
3. Trajet ≤ km_inclus (distance < 4 km) → km_factures = 0, forfait seul.
4. TPMR → supplément 30 € ajouté.
5. Majoration nuit (départ 21h Réunion).
6. Majoration weekend (samedi 14h).
7. Majoration weekend (dimanche 10h).
8. Majoration férié (date ∈ holidays974).
9. Priorité férié > nuit (jour férié à 22h → motif 'ferie').
10. Coords manquantes → `distance_method='unavailable'`, forfait + DROM + TPMR seuls.
11. Samedi avant 12h → pas de majoration weekend.
12. Bug timezone : un `scheduled_at` à 23h UTC = 03h Réunion lendemain → vérifier le bon jour + heure locale.

> **5+ cas de référence dirigeant** : à intégrer en wave execute si fournis (validation ±0,01 €).

---

## Critères GREEN

- `pnpm -C packages/pricing test` : 100% branches/functions/lines/statements.
- `pnpm typecheck` workspace PASS.
- Migration `20260522000001_tariff_grids.sql` syntaxiquement valide.
- Aucune valeur tarifaire hardcodée dans `compute-cgss-short-trip.ts` (toutes via `grid`).

---

## Risques + mitigations

- **Conversion timezone** : `Intl.DateTimeFormat` avec `timeZone: 'Indian/Reunion'` est fiable ; Réunion sans DST → décalage fixe +4h acceptable en fallback. Tester explicitement (cas 12).
- **`roundTo` arrondi** : l'arrondi 0,05 € est un paramètre grille — helper `roundTo(value, step)` générique.
- **Rétrocompat `index.ts`** : les consommateurs Phase 04.7 importent `PricingResult` — Wave 2 adapte. Wave 1 peut casser temporairement le typecheck `apps/web` → acceptable si Wave 1 + Wave 2 mergées ensemble OU Wave 2 suit immédiatement.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Hardcoder 13 / 1,22 / 3 / 30 / 50 / 1,4 dans le code TS (seed BDD uniquement).
- ❌ `getUTCHours` pour la majoration nuit (bug stub — utiliser Indian/Reunion).
- ❌ Cumuler les majorations (DEC-059 — une seule, priorité férié > weekend > nuit).
- ❌ Transport partagé / abattements / retour à vide (DEC-058 — Phase 06).
- ❌ Appliquer la migration via MCP (DEC-032 — CD push exclusif).
