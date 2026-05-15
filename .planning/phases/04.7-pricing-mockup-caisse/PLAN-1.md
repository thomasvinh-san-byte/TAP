---
phase: 04.7
plan: 1
plan_number: 1
slug: pricing-mockup
type: execute
status: draft
estimated_hours: 1.5-2
wave: 1
depends_on: []
files_modified:
  - packages/pricing/package.json (NEW)
  - packages/pricing/tsconfig.json (NEW)
  - packages/pricing/vitest.config.ts (NEW)
  - packages/pricing/src/index.ts (NEW)
  - packages/pricing/src/compute-cgss-short-trip.ts (NEW)
  - packages/pricing/src/__tests__/compute-cgss-short-trip.test.ts (NEW)
  - apps/web/src/app/(app)/courses/_components/pricing-breakdown.client.tsx (NEW)
  - apps/web/src/app/(app)/courses/_components/override-tarif-modal.client.tsx (NEW)
  - apps/web/src/app/(app)/courses/actions/override.ts (NEW)
  - apps/web/src/app/(app)/courses/actions/index.ts (modif barrel)
  - apps/web/src/app/(driver)/conduite/_components/end-ride-modal.client.tsx (modif)
  - apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx (modif)
  - apps/web/tests/e2e/override-tarif.spec.ts (NEW)
autonomous: true
decisions_implemented:
  - DEC-042
tags:
  - pricing
  - stub
  - audit
  - sheet
must_haves:
  truths:
    - "computeCgssShortTrip retourne PricingResult avec 100% branch coverage Vitest (DEC-042)"
    - "PricingBreakdown rendu inline dans end-ride-modal (chauffeur, editable=false) + ride-drawer (régulateur, editable=true)"
    - "Badge « DEMO » visible sur chaque rendu PricingBreakdown"
    - "Bandeau warning R3 affiché quand source='fallback_random'"
    - "OverrideTarifModal accessible depuis bouton Modifier dans ride-drawer, dirigeant + régulateur"
    - "Motif d'override required min 10 chars max 500"
    - "Trace audit_logs action='ride.tarif.override' avec metadata { old_amount, new_amount, old_source, reason }"
    - "Pattern DEC-041 row count check appliqué à overrideRideTarifAction"
    - "Test E2E override-tarif.spec.ts couvre golden path régulateur"
  artifacts:
    - path: "packages/pricing/src/compute-cgss-short-trip.ts"
      provides: "Stub pricing Haversine + fallback random DEC-042"
    - path: "apps/web/src/app/(app)/courses/_components/pricing-breakdown.client.tsx"
      provides: "Surface A — composant inline avec badge DEMO"
    - path: "apps/web/src/app/(app)/courses/_components/override-tarif-modal.client.tsx"
      provides: "Surface B — Sheet édition tarif"
    - path: "apps/web/src/app/(app)/courses/actions/override.ts"
      provides: "Server Action overrideRideTarifAction + audit_logs insert"
  key_links:
    - from: "ride-drawer.client.tsx section Paiement"
      to: "override-tarif-modal.client.tsx"
      via: "bouton « Modifier » sur PricingBreakdown editable=true"
      pattern: "onOverride={() => setOverrideOpen(true)}"
    - from: "overrideRideTarifAction"
      to: "audit_logs"
      via: "insert explicite ride.tarif.override avec metadata"
      pattern: "action: 'ride.tarif.override'"
---

<objective>
T1 — Pricing mockup démo : exposer une chaîne UI tarif lisible sans le calcul réel CGSS (réservé Phase 05.5). Le composant `PricingBreakdown` affiche le détail (forfait + km × prix + majo nuit + supplément TPMR + total) avec un badge « DEMO » obligatoire. Le `OverrideTarifModal` (Sheet) permet à dirigeant + régulateur de forcer un tarif avec motif obligatoire et trace `audit_logs` exhaustive.

Output : 1 nouveau workspace `packages/pricing` + 2 composants Client UI + 1 Server Action + 1 test E2E + 100 % branch coverage Vitest sur le stub.

Verrous : DEC-042 LOCKED (Haversine + fallback), DEC-041 row count check, V4 conformité UI-PATTERNS, V8 tests E2E avant merge.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/UI-PATTERNS.md
@.planning/phases/04.7-pricing-mockup-caisse/04.7-CONTEXT.md
@.planning/phases/04.7-pricing-mockup-caisse/04.7-DISCUSSION-LOG.md
@.planning/phases/04.7-pricing-mockup-caisse/04.7-UI-SPEC.md

# Patterns existants à reproduire
@packages/shared/package.json
@packages/shared/vitest.config.ts
@packages/shared/src/utils/driver-vehicle-compat.ts
@packages/shared/src/utils/__tests__/driver-vehicle-compat.test.ts

# Fichiers à modifier
@apps/web/src/app/(driver)/conduite/_components/end-ride-modal.client.tsx
@apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx
@apps/web/src/app/(app)/courses/actions/index.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1.1 — Scaffold packages/pricing + stub computeCgssShortTrip + Vitest 100%</name>
  <files>
    packages/pricing/package.json,
    packages/pricing/tsconfig.json,
    packages/pricing/vitest.config.ts,
    packages/pricing/src/index.ts,
    packages/pricing/src/compute-cgss-short-trip.ts,
    packages/pricing/src/__tests__/compute-cgss-short-trip.test.ts
  </files>
  <action>
Per DEC-042. Scaffold pnpm workspace miroir `packages/shared` (config alignée).

Étapes :

1. **`packages/pricing/package.json`** :
   ```json
   {
     "name": "@tap/pricing",
     "version": "0.0.0",
     "private": true,
     "type": "module",
     "exports": { ".": "./src/index.ts" },
     "scripts": {
       "test": "vitest run",
       "test:watch": "vitest",
       "typecheck": "tsc --noEmit",
       "lint": "next lint --dir src"
     },
     "dependencies": {},
     "devDependencies": { "typescript": "^5.6.3", "vitest": "^2.1.9" }
   }
   ```
   Pas de dépendance runtime — algo pur Haversine + random.

2. **`packages/pricing/tsconfig.json`** : copier `packages/shared/tsconfig.json` (strict, target ES2022).

3. **`packages/pricing/vitest.config.ts`** : copier `packages/shared/vitest.config.ts` avec `coverage.thresholds.branches = 100` ajouté.

4. **`packages/pricing/src/compute-cgss-short-trip.ts`** :
   ```ts
   export type TransportMode = 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';
   export type Urgency = 'programmee' | 'urgente' | 'immediate';
   export type PricingSource = 'haversine' | 'fallback_random';

   export interface PricingInput {
     pickup_lat?: number | null;
     pickup_lng?: number | null;
     dropoff_lat?: number | null;
     dropoff_lng?: number | null;
     scheduled_at: string; // ISO timestamp
     transport_mode: TransportMode;
     urgency: Urgency;
   }

   export interface PricingResult {
     forfait_eur: number;
     distance_km: number | null;
     prix_km_eur: number | null;
     km_total_eur: number | null;
     majo_nuit_pct: number;
     majo_nuit_eur: number;
     supp_tpmr_eur: number;
     total_eur: number;
     source: PricingSource;
   }

   const FORFAIT_EUR = 4.20;
   const PRIX_KM_EUR = 2.10;
   const SUPP_TPMR_EUR = 5.00;
   const MAJO_NUIT_PCT = 20;
   const EARTH_RADIUS_KM = 6371;
   const MIN_TOTAL = 10;
   const MAX_TOTAL = 80;

   function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
     const toRad = (d: number) => (d * Math.PI) / 180;
     const dLat = toRad(lat2 - lat1);
     const dLng = toRad(lng2 - lng1);
     const a =
       Math.sin(dLat / 2) ** 2 +
       Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
     return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
   }

   function isNuit(iso: string): boolean {
     const h = new Date(iso).getUTCHours();
     return h >= 20 || h < 7;
   }

   function roundTo5cents(n: number): number {
     return Math.round(n * 20) / 20;
   }

   function clamp(n: number, min: number, max: number): number {
     return Math.max(min, Math.min(max, n));
   }

   function pseudoRandomFallback(input: PricingInput): number {
     // Pseudo-random déterministe basé sur scheduled_at pour éviter
     // que deux affichages successifs donnent des montants différents.
     const seed = new Date(input.scheduled_at).getTime() % 7919;
     const baseRange = input.urgency === 'immediate' ? 25 : 18;
     return baseRange + (seed % 22); // 18-40 normal, 25-47 urgent
   }

   export function computeCgssShortTrip(input: PricingInput): PricingResult {
     const hasCoords =
       typeof input.pickup_lat === 'number' &&
       typeof input.pickup_lng === 'number' &&
       typeof input.dropoff_lat === 'number' &&
       typeof input.dropoff_lng === 'number';

     let distance_km: number | null = null;
     let prix_km_eur: number | null = null;
     let km_total_eur: number | null = null;
     let baseTotal: number;
     let source: PricingSource;

     if (hasCoords) {
       distance_km = haversineKm(
         input.pickup_lat!, input.pickup_lng!,
         input.dropoff_lat!, input.dropoff_lng!,
       );
       prix_km_eur = PRIX_KM_EUR;
       km_total_eur = roundTo5cents(distance_km * PRIX_KM_EUR);
       baseTotal = FORFAIT_EUR + km_total_eur;
       source = 'haversine';
     } else {
       baseTotal = pseudoRandomFallback(input);
       source = 'fallback_random';
     }

     const supp_tpmr_eur = input.transport_mode === 'tpmr' ? SUPP_TPMR_EUR : 0;
     const isMajoNuit = isNuit(input.scheduled_at);
     const majo_nuit_pct = isMajoNuit ? MAJO_NUIT_PCT : 0;
     const majo_nuit_eur = isMajoNuit
       ? roundTo5cents((baseTotal + supp_tpmr_eur) * (MAJO_NUIT_PCT / 100))
       : 0;
     const totalRaw = baseTotal + supp_tpmr_eur + majo_nuit_eur;
     const total_eur = roundTo5cents(clamp(totalRaw, MIN_TOTAL, MAX_TOTAL));

     return {
       forfait_eur: FORFAIT_EUR,
       distance_km,
       prix_km_eur,
       km_total_eur,
       majo_nuit_pct,
       majo_nuit_eur,
       supp_tpmr_eur,
       total_eur,
       source,
     };
   }
   ```

5. **`packages/pricing/src/__tests__/compute-cgss-short-trip.test.ts`** (≥ 100 % branch) :
   - Cas Haversine simple (Saint-Denis → CHU Bellepierre, ~3 km)
   - Cas Haversine long trajet (Saint-Denis → Saint-Pierre, ~80 km plat → clamp 80 €)
   - Cas fallback_random (pas de coords)
   - Cas majo nuit (scheduled_at 22h00 UTC)
   - Cas pas de majo nuit (scheduled_at 14h00 UTC)
   - Cas supp TPMR
   - Cas urgence immediate fallback (range plus haut)
   - Cas clamp min (distance 0 km → forfait 4.20 → clamp 10)

6. **`packages/pricing/src/index.ts`** : barrel `export *`.

7. **Mise à jour `pnpm-workspace.yaml`** : vérifier que `packages/*` est déjà glob (oui — vu via `packages/shared`).
  </action>
  <verify>
    <automated>cd packages/pricing && pnpm typecheck</automated>
    <automated>cd packages/pricing && pnpm test --coverage</automated>
    Couverture branch attendue : 100 %.
  </verify>
  <done>
    - packages/pricing workspace créé + dépendances pnpm résolues
    - computeCgssShortTrip exporté + types PricingInput/Result
    - Vitest 100 % branch coverage
    - Constantes (FORFAIT, PRIX_KM, MAJO, SUPP_TPMR, MIN/MAX) déclarées en haut du fichier pour relecture future Phase 05.5
  </done>
  <rollback>
    Supprimer `packages/pricing/` entièrement. Aucun consommateur sur le code prod tant que T1.2 pas livrée.
  </rollback>
</task>

<task type="auto">
  <name>Task 1.2 — Composant PricingBreakdown UI (Surface A) + intégration end-ride-modal + ride-drawer</name>
  <files>
    apps/web/src/app/(app)/courses/_components/pricing-breakdown.client.tsx,
    apps/web/src/app/(driver)/conduite/_components/end-ride-modal.client.tsx,
    apps/web/src/app/(app)/courses/_components/ride-drawer.client.tsx
  </files>
  <action>
Per UI-SPEC Surface A. Composant Client inline réutilisé en 2 sites.

Étapes :

1. **`pricing-breakdown.client.tsx`** : créer composant per UI-SPEC § Surface A.
   - Props `{ pricing: PricingResult, editable?: boolean, onOverride?: () => void }`
   - Layout : container `rounded-md border border-border bg-muted/20 p-16`
   - Header `flex items-center justify-between mb-12` : titre + badge DEMO
   - Lignes `flex justify-between text-sm` avec `font-mono tabular-nums` à droite
   - Conditions affichage :
     - Si `source === 'fallback_random'` → bandeau warning R3 en haut
     - Si `source === 'haversine'` → ligne distance × prix affichée
     - Si `majo_nuit_eur > 0` → ligne majo affichée
     - Si `supp_tpmr_eur > 0` → ligne supp affichée
   - Total : `border-t border-border pt-12 mt-12 text-base font-semibold tabular-nums`
   - Bouton Modifier (Lucide Pencil + texte) si `editable && onOverride`

2. **Intégration `end-ride-modal.client.tsx`** :
   - Import `import { computeCgssShortTrip } from '@tap/pricing'`
   - Calculer pricing à l'ouverture de la modal (memo dépendant du ride)
   - Rendre `<PricingBreakdown pricing={pricing} editable={false} />` au-dessus du champ tarif manuel
   - Le chauffeur peut s'inspirer du stub puis saisir son tarif manuel (workflow inchangé)

3. **Intégration `ride-drawer.client.tsx`** :
   - Import `import { computeCgssShortTrip } from '@tap/pricing'`
   - Dans la section Paiement (existant), si `ride.status === 'terminee'` :
     - Calculer pricing depuis ride.pickup_lat/lng + dropoff_lat/lng (après PLAN-3 ces colonnes existent ; entre-temps, fallback random)
     - Rendre `<PricingBreakdown pricing={pricing} editable={true} onOverride={() => setOverrideOpen(true)} />`
   - `setOverrideOpen` est un useState local du drawer

Hors scope : ne pas refactor end-ride-modal ni ride-drawer hors insertion du composant. Pas de polish discrétionnaire.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck</automated>
    Manual preview Vercel : ouvrir end-ride-modal → PricingBreakdown visible avec badge DEMO. Ouvrir ride-drawer d'une course terminée → PricingBreakdown avec bouton Modifier.
  </verify>
  <done>
    - PricingBreakdown rendu inline dans end-ride-modal (editable=false)
    - PricingBreakdown rendu inline dans ride-drawer (editable=true)
    - Badge DEMO visible sur les 2 sites
    - Bandeau warning R3 affiché en fallback_random
    - Tabular-nums sur tous montants
    - Bouton Modifier visible côté régulateur seulement
  </done>
  <rollback>
    `git revert` du commit composant + intégration. Pas d'impact BDD.
  </rollback>
</task>

<task type="auto">
  <name>Task 1.3 — OverrideTarifModal (Surface B) + Server Action + audit_logs + E2E</name>
  <files>
    apps/web/src/app/(app)/courses/_components/override-tarif-modal.client.tsx,
    apps/web/src/app/(app)/courses/actions/override.ts,
    apps/web/src/app/(app)/courses/actions/index.ts,
    apps/web/tests/e2e/override-tarif.spec.ts
  </files>
  <action>
Per UI-SPEC Surface B + DEC-041.

Étapes :

1. **`override-tarif-modal.client.tsx`** : Sheet shadcn latéral droit.
   - Props `{ open, onOpenChange, rideId, currentTarifEur, pricingSource }`
   - Form react-controlled (useState pour tarif + motif)
   - Validation client : tarif > 0 && <= 999.99, motif ≥ 10 chars && ≤ 500
   - `aria-invalid` + `aria-describedby` motif help
   - SheetTitle « Modifier le tarif », SheetDescription « L'override est tracé dans l'audit log avec acteur et motif. »
   - Bouton Confirmer disabled si form invalid (`disabled` + `aria-disabled`)
   - Callback `onSubmit` → appel `overrideRideTarifAction` → toast Sonner success/error → close

2. **`actions/override.ts`** : Server Action.
   ```ts
   'use server';

   import { z } from 'zod';
   import { revalidatePath } from 'next/cache';
   import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
   import { createClient } from '@/lib/supabase/server';

   const overrideSchema = z.object({
     rideId: z.string().uuid(),
     newTarifEur: z.number().positive().max(999.99),
     reason: z.string().trim().min(10).max(500),
   });

   export async function overrideRideTarifAction(
     input: z.infer<typeof overrideSchema>,
   ): Promise<{ success?: true; error?: string }> {
     const parsed = overrideSchema.safeParse(input);
     if (!parsed.success) return { error: 'Saisie invalide.' };

     const ctx = await requireAdminOrRegulateur();
     if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

     const supabase = createClient();

     // 1. Lire l'ancien tarif pour audit metadata
     const before = await supabase
       .from('rides')
       .select('tarif_amount_eur, tarif_source, organization_id')
       .eq('id', parsed.data.rideId)
       .single();
     if (before.error || !before.data) return { error: 'Course introuvable.' };

     // 2. UPDATE avec pattern DEC-041 row count check
     const updated = await supabase
       .from('rides')
       .update({
         tarif_amount_eur: parsed.data.newTarifEur,
         tarif_source: 'override',
       } as never)
       .eq('id', parsed.data.rideId)
       .select('id');
     if (updated.error) return { error: 'Modification impossible.' };
     if (!updated.data || updated.data.length === 0) {
       return { error: 'Modification refusée — droits insuffisants.' };
     }

     // 3. Insert audit_logs explicite
     await supabase.from('audit_logs').insert({
       organization_id: before.data.organization_id,
       actor_id: ctx.userId,
       actor_role: ctx.role,
       action: 'ride.tarif.override',
       entity_type: 'ride',
       entity_id: parsed.data.rideId,
       metadata: {
         old_amount: before.data.tarif_amount_eur,
         old_source: before.data.tarif_source,
         new_amount: parsed.data.newTarifEur,
         reason: parsed.data.reason,
       },
     } as never);

     revalidatePath('/courses');
     return { success: true };
   }
   ```

3. **`actions/index.ts`** : ajouter export `overrideRideTarifAction`.

4. **`override-tarif.spec.ts`** E2E :
   - Login régulateur
   - Naviguer vers /courses (liste rides)
   - Trouver une ride terminée, ouvrir drawer
   - Vérifier PricingBreakdown visible avec bouton Modifier
   - Cliquer Modifier → Sheet s'ouvre
   - Saisir tarif 28.50 + motif « Détour imposé par travaux Boulevard Vauban ce matin »
   - Cliquer Confirmer → toast success
   - Re-ouvrir drawer → assert nouveau tarif affiché (28,50 €) + badge source « Override »

Verrous :
- DEC-041 row count check appliqué
- `requireAdminOrRegulateur` côté serveur (defense in depth si UI cache le bouton mais user forge requête)
- Toast Sonner success/error post-action
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck</automated>
    <automated>cd apps/web && pnpm exec playwright test tests/e2e/override-tarif.spec.ts --reporter=line</automated>
  </verify>
  <done>
    - OverrideTarifModal Sheet fonctionnel + form validation
    - overrideRideTarifAction Server Action + DEC-041 + audit_logs insert
    - E2E test PASS sur preview Vercel ou skip propre si pas de ride terminée
    - Toast Sonner sur success + error
    - Permissions DOM + serveur cohérentes
  </done>
  <rollback>
    `git revert` du commit. Audit log entry restera (acceptable, c'est une trace immutable). UI revient à l'état pré-fix.
  </rollback>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → packages/pricing | computeCgssShortTrip est pur, pas de network |
| Client → overrideRideTarifAction | Server Action authentifiée + RLS Postgres |
| Server Action → audit_logs | Insert direct, pas trigger (entity_type/action stables) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04.7-01 | Information Disclosure | pricing stub côté client | accept | Algo public, pas de secret. Phase 05.5 livrera l'algo réel CGSS qui peut rester serveur si sensible. |
| T-04.7-02 | Tampering | OverrideTarifModal bypass UI cache | mitigate | Server Action `requireAdminOrRegulateur` defense in depth + audit_logs |
| T-04.7-03 | Repudiation | override silencieux | mitigate | audit_logs avec metadata ancien + nouveau + motif + acteur |
| T-04.7-04 | Spoofing | role escalation | mitigate | RLS Postgres + helper requireAdminOrRegulateur |
| T-04.7-05 | Denial of Service | spam d'overrides | accept | Rate limit applicatif non requis V1.5. Motif min 10 chars dissuade. |
</threat_model>

<verification>
1. Vitest 100 % branch coverage sur computeCgssShortTrip
2. TypeScript strict OK sur packages/pricing + apps/web
3. PricingBreakdown rendu visible dans 2 sites (end-ride-modal + ride-drawer)
4. OverrideTarifModal Sheet a11y conforme (Esc close, focus trap natif)
5. overrideRideTarifAction trace audit_logs vérifié via MCP lecture seule
6. E2E override-tarif.spec.ts PASS
</verification>

<success_criteria>
- [ ] DEC-042 LOCKED dans PROJECT.md (à inscrire post-merge plan)
- [ ] PricingBreakdown rendu inline 2 sites avec badge DEMO
- [ ] OverrideTarifModal accessible depuis bouton Modifier régulateur
- [ ] Trace audit_logs visible via SQL `SELECT * FROM audit_logs WHERE action = 'ride.tarif.override'`
- [ ] Test E2E PASS
- [ ] Capture preview Vercel `.planning/phases/04.7-pricing-mockup-caisse/captures/A-pricing-breakdown.png` + `B-override-tarif-modal.png`
</success_criteria>

<output>
Après exécution, créer `.planning/phases/04.7-pricing-mockup-caisse/04.7-1-SUMMARY.md` synthétisant :
- Décisions implémentées (DEC-042)
- Couverture Vitest computeCgssShortTrip (% branch)
- Captures Surface A + Surface B
- Lien preview Vercel
</output>
