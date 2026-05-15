---
phase: 04.7
plan: 3
plan_number: 3
slug: geocoding-migration
type: execute
status: draft
estimated_hours: 1-1.5
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/<timestamp>_rides_geocoding.sql (NEW)
  - apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx (modif onSelect signature)
  - apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx (modif — capture coords)
  - apps/web/src/app/(app)/courses/actions/create.ts (modif — persister coords)
  - apps/web/src/app/(app)/courses/actions/edit.ts (modif — persister coords)
  - apps/web/src/app/(app)/courses/_lib/queries.ts (modif RIDE_COLUMNS)
  - packages/database/src/types.gen.ts (régénération auto cron)
  - apps/web/src/app/(admin)/admin/maintenance/page.tsx (NEW)
  - apps/web/src/app/(admin)/admin/maintenance/_components/backfill-geocoding.client.tsx (NEW)
  - apps/web/src/app/(admin)/admin/maintenance/actions.ts (NEW — backfillRideGeocodingAction)
  - supabase/tests/rides_geocoding_columns.sql (NEW pgTAP)
autonomous: true
decisions_implemented:
  - DEC-044
tags:
  - migration
  - geocoding
  - bdd
  - cd
must_haves:
  truths:
    - "Migration <timestamp>_rides_geocoding.sql appliquée via CD push (DEC-032 strict)"
    - "6 colonnes nullables ajoutées à rides : pickup_lat/lng/citycode + dropoff_lat/lng/citycode"
    - "AddressOrPOIPicker.onSelect signature élargie pour propager lat/lng/citycode"
    - "createRideAction + editRideAction persistent les 6 colonnes (nullable)"
    - "Page /admin/maintenance (dirigeant only) avec bouton « Re-géocoder courses sans coords »"
    - "backfillRideGeocodingAction idempotent (DO UPDATE seulement si NULL) + rate-limit BAN 1 req/s"
    - "Test pgTAP rides_geocoding_columns.sql vérifie présence colonnes + nullable"
  artifacts:
    - path: "supabase/migrations/<timestamp>_rides_geocoding.sql"
      provides: "Migration BDD 6 colonnes géocoding rides"
    - path: "address-or-poi-picker.client.tsx onSelect"
      provides: "Threading lat/lng/citycode BAN + POI vers parent"
    - path: "backfillRideGeocodingAction"
      provides: "Server Action one-shot dirigeant pour re-géocoder courses existantes"
  key_links:
    - from: "AddressOrPOIPicker BAN suggestion"
      to: "f.geometry.coordinates + f.properties.citycode"
      via: "onSelect({ lat, lng, citycode })"
      pattern: "lat: f.geometry.coordinates[1]"
    - from: "AddressOrPOIPicker POI suggestion"
      to: "pois_metier.latitude/longitude"
      via: "onSelect({ lat: poi.latitude, lng: poi.longitude })"
      pattern: "lat: poi.latitude"
---

<objective>
T3 — Migration géocoding lat/lng/citycode : persister les coordonnées BAN/POI sur les courses pour permettre le calcul réel CGSS Phase 05.5 (Haversine ou OSRM). Migration BDD via CD strict (DEC-032), threading dans AddressOrPOIPicker, Server Action backfill one-shot dirigeant.

Output : 1 migration BDD + élargissement signature `AddressOrPOIPicker.onSelect` + capture coords dans `ride-express-modal` + persistance Server Actions create/edit + 1 page admin maintenance + 1 test pgTAP.

Verrous : DEC-044 LOCKED, DEC-032 CD exclusif strict, V7 row count check sur backfill.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/UI-PATTERNS.md
@.planning/phases/04.7-pricing-mockup-caisse/04.7-CONTEXT.md

# Pattern migration récent
@supabase/migrations/20260516000004_pois_metier.sql

# Composants à modifier
@apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx
@apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx
@apps/web/src/app/(app)/courses/actions/create.ts
@apps/web/src/app/(app)/courses/actions/edit.ts
@apps/web/src/app/(app)/courses/_lib/queries.ts

# Pattern admin existant
@apps/web/src/app/(admin)/admin/chauffeurs/page.tsx
@apps/web/src/lib/auth/require-dirigeant-page.ts
</context>

<tasks>

<task type="auto">
  <name>Task 3.1 — Migration BDD géocoding + test pgTAP (CD push exclusif DEC-032)</name>
  <files>
    supabase/migrations/<timestamp>_rides_geocoding.sql,
    supabase/tests/rides_geocoding_columns.sql
  </files>
  <action>
Per DEC-044 + DEC-032 (CD push exclusif, INTERDICTION MCP apply_migration).

Étapes :

1. **Migration `<timestamp>_rides_geocoding.sql`** (timestamp = `date +%Y%m%d%H%M%S` au moment de l'exécution) :
   ```sql
   -- =========================================================================
   -- Migration — Géocoding rides (Phase 04.7 T3.1, DEC-044)
   -- =========================================================================
   -- Ajout colonnes nullables pickup_lat/lng/citycode + dropoff_* sur rides
   -- pour persister coordonnées BAN/POI au moment de la saisie course.
   -- Préfigure le calcul tarif réel CGSS Phase 05.5 (Haversine ou OSRM).
   --
   -- Toutes nullables : compat existant + courses créées sans BAN (saisie libre).
   -- Refs : DEC-044, DEC-032 (CD push exclusif).
   -- =========================================================================

   alter table public.rides
     add column pickup_lat numeric(10, 7),
     add column pickup_lng numeric(10, 7),
     add column pickup_citycode text,
     add column dropoff_lat numeric(10, 7),
     add column dropoff_lng numeric(10, 7),
     add column dropoff_citycode text;

   -- Index optionnel pour requêtes par commune INSEE (citycode).
   create index rides_pickup_citycode_idx
     on public.rides (pickup_citycode)
     where pickup_citycode is not null;

   create index rides_dropoff_citycode_idx
     on public.rides (dropoff_citycode)
     where dropoff_citycode is not null;

   comment on column public.rides.pickup_lat is
     'Latitude pickup (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
   comment on column public.rides.pickup_lng is
     'Longitude pickup (WGS84). Source : BAN gouv.fr ou POI métier. Phase 04.7 DEC-044.';
   comment on column public.rides.pickup_citycode is
     'Code INSEE commune pickup (5 chiffres). Source BAN/POI. Phase 04.7 DEC-044.';
   ```

2. **Test pgTAP `rides_geocoding_columns.sql`** :
   - Vérifie présence 6 colonnes + nullable + type numeric(10,7) pour lat/lng + text pour citycode
   - Vérifie présence 2 index partiels

3. **Application** : `git push` sur main → CD `cd.yml` exécute `supabase db push`. INTERDICTION absolue d'utiliser `mcp__supabase__apply_migration` ou `mcp__supabase__execute_sql` pour DDL (DEC-032 strict).

Vérification post-CD : lecture seule MCP `SELECT column_name FROM information_schema.columns WHERE table_name='rides' AND column_name LIKE '%lat%';`.
  </action>
  <verify>
    Manual : après push, suivre run cd.yml GitHub Actions. Vert = migration appliquée. Si rouge, diagnostic immédiat.
    pgTAP run automatique dans CI rls-tests job (sera rouge par dette pré-existante D3, mais le fichier nouveau doit au moins être syntaxiquement valide).
  </verify>
  <done>
    - Migration mergée + CD vert + schema_migrations aligné
    - 6 colonnes visibles via MCP lecture seule
    - 2 index partiels créés
    - Test pgTAP file ajouté (run en CI quand env runner sera fixé Phase 06)
  </done>
  <rollback>
    Créer une nouvelle migration `<later_timestamp>_rides_geocoding_rollback.sql` avec `ALTER TABLE rides DROP COLUMN pickup_lat, ...` + `DROP INDEX rides_pickup_citycode_idx, ...`. Jamais de DROP en MCP direct.
  </rollback>
</task>

<task type="auto">
  <name>Task 3.2 — Threading lat/lng/citycode dans AddressOrPOIPicker + ride-express-modal + Server Actions</name>
  <files>
    apps/web/src/app/(app)/courses/_components/address-or-poi-picker.client.tsx,
    apps/web/src/app/(app)/courses/_components/ride-express-modal.client.tsx,
    apps/web/src/app/(app)/courses/actions/create.ts,
    apps/web/src/app/(app)/courses/actions/edit.ts,
    apps/web/src/app/(app)/courses/_lib/queries.ts
  </files>
  <action>
Per DEC-044.

Étapes :

1. **`address-or-poi-picker.client.tsx`** : élargir signature.
   - `AddressOrPOIPickerSelection` interface inclut déjà `postcode` + `city` + `notesAcces` + `poiId`. Ajouter `lat?: number, lng?: number, citycode?: string`.
   - Dans `select(s: Suggestion)` :
     - Cas POI : `lat: s.poi.latitude ?? undefined, lng: s.poi.longitude ?? undefined, citycode: undefined` (POI a pas de citycode pour l'instant, ou alors `s.poi.code_postal` si on veut, à décider). Reco V1 : laisser undefined, on a déjà postcode.
     - Cas BAN : `lat: ... [need to capture from fetchBanSuggestions]`, `lng: ...`, `citycode: ...`
   - Dans `fetchBanSuggestions` : `BanSuggestion` interface ajoute `lat: number, lng: number, citycode: string`. Mapping `f.geometry.coordinates[1]` + `f.properties.citycode`.

2. **`ride-express-modal.client.tsx`** : capturer coords dans le state form.
   - Étendre `FormState` (ou utiliser un state local) avec `pickup_lat?, pickup_lng?, pickup_citycode?, dropoff_*?`.
   - `onSelect` du picker : `(selection) => { updateField('pickup_address', selection.label); updateField('pickup_lat', selection.lat); updateField('pickup_lng', selection.lng); updateField('pickup_citycode', selection.citycode); }`.
   - Idem dropoff.

3. **`actions/create.ts createRideAction`** : accepter + persister les 6 colonnes.
   - Étendre `rideExpressInputSchema` Zod (probablement dans `@tap/shared/validators/ride`) pour inclure les coords optionnelles.
   - INSERT body inclut les 6 colonnes (nullable).

4. **`actions/edit.ts updateRideAction`** : idem pour la mise à jour.

5. **`_lib/queries.ts RIDE_COLUMNS`** : ajouter les 6 colonnes pour qu'elles soient renvoyées par `getRideByIdEnriched` (le drawer en aura besoin pour le PricingBreakdown PLAN-1 T1.2).

Note : `packages/database/src/types.gen.ts` doit être régénéré via cron `sync-types.yml`. Si pas régénéré au moment de l'exécution, casts ciblés `as never` (pattern Phase 04.5).

Hors scope : pas de migration de validation Zod centralisée — `rideExpressInputSchema` déjà existant juste étendu.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck</automated>
    Manual preview Vercel : saisir une course → sélectionner adresse BAN → vérifier en BDD via MCP que `pickup_lat/lng/citycode` sont remplis.
  </verify>
  <done>
    - AddressOrPOIPicker propage lat/lng/citycode pour BAN + POI (POI = lat/lng, citycode undefined V1)
    - createRideAction + editRideAction persistent les 6 colonnes
    - RIDE_COLUMNS inclut les 6 pour le drawer
  </done>
  <rollback>
    `git revert`. Colonnes BDD restent (nullables, OK). Pas d'impact runtime.
  </rollback>
</task>

<task type="auto">
  <name>Task 3.3 — Page /admin/maintenance + backfillRideGeocodingAction (one-shot dirigeant)</name>
  <files>
    apps/web/src/app/(admin)/admin/maintenance/page.tsx,
    apps/web/src/app/(admin)/admin/maintenance/_components/backfill-geocoding.client.tsx,
    apps/web/src/app/(admin)/admin/maintenance/actions.ts
  </files>
  <action>
Per A-04 reco a + DEC-032 esprit (tout via Server Actions tracées).

Étapes :

1. **`page.tsx`** Server Component dirigeant only :
   ```tsx
   import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
   import { BackfillGeocoding } from './_components/backfill-geocoding.client';

   export const metadata = { title: 'Maintenance — TAP Admin' };

   export default async function MaintenancePage() {
     await requireDirigeantPage();
     return (
       <div className="space-y-24 max-w-[720px]">
         <header>
           <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
           <p className="text-sm text-muted-foreground">
             Opérations ponctuelles sur les données. Réservé au dirigeant.
           </p>
         </header>
         <section className="rounded-md border border-border p-16 space-y-12">
           <h2 className="text-sm font-semibold">Géocoding rides</h2>
           <p className="text-xs text-muted-foreground">
             Re-géocode les courses créées avant la migration géocoding (Phase 04.7).
             Idempotent : ne touche que les rides sans coordonnées.
           </p>
           <BackfillGeocoding />
         </section>
       </div>
     );
   }
   ```

2. **`backfill-geocoding.client.tsx`** :
   - Bouton « Lancer le re-géocodage » (state `pending` + `result`)
   - Au clic : appel `backfillRideGeocodingAction()` → toast Sonner progress (« X / Y traitées »)
   - Affichage résumé final (X courses re-géocodées, Y skipped, Z erreurs)

3. **`actions.ts backfillRideGeocodingAction`** :
   ```ts
   'use server';

   import { requireDirigeant } from '@/lib/auth/require-dirigeant';
   import { createClient } from '@/lib/supabase/server';

   export async function backfillRideGeocodingAction(): Promise<{
     processed: number;
     skipped: number;
     errors: number;
     error?: string;
   }> {
     const ctx = await requireDirigeant();
     if (!ctx) return { processed: 0, skipped: 0, errors: 0, error: 'Réservé au dirigeant.' };
     const supabase = createClient();
     const target = await supabase
       .from('rides')
       .select('id, pickup_address, dropoff_address')
       .is('pickup_lat', null)
       .limit(200);
     if (target.error) return { processed: 0, skipped: 0, errors: 1, error: 'Lecture impossible.' };

     let processed = 0, skipped = 0, errors = 0;
     for (const ride of target.data ?? []) {
       const pickup = await geocodeBan(ride.pickup_address);
       const dropoff = await geocodeBan(ride.dropoff_address);
       if (!pickup && !dropoff) { skipped++; continue; }
       const upd = await supabase
         .from('rides')
         .update({
           pickup_lat: pickup?.lat ?? null,
           pickup_lng: pickup?.lng ?? null,
           pickup_citycode: pickup?.citycode ?? null,
           dropoff_lat: dropoff?.lat ?? null,
           dropoff_lng: dropoff?.lng ?? null,
           dropoff_citycode: dropoff?.citycode ?? null,
         } as never)
         .eq('id', ride.id)
         .select('id');
       if (upd.error || !upd.data || upd.data.length === 0) { errors++; continue; }
       processed++;
       await new Promise((r) => setTimeout(r, 1000)); // rate-limit 1 req/s BAN
     }

     // Audit log unique pour traçabilité
     await supabase.from('audit_logs').insert({
       organization_id: ctx.organizationId,
       actor_id: ctx.userId, actor_role: ctx.role,
       action: 'maintenance.backfill_geocoding', entity_type: 'maintenance',
       entity_id: null,
       metadata: { processed, skipped, errors },
     } as never);

     return { processed, skipped, errors };
   }

   async function geocodeBan(address: string) {
     // Implémentation : fetch api-adresse.data.gouv.fr/search, filter score >= 0.5
     // Retourne { lat, lng, citycode } ou null
   }
   ```

   Pattern DEC-041 row count check sur UPDATE.

Hors scope V1.5 :
- Pagination > 200 rides (à itérer plusieurs runs si volume)
- Toast progressbar fin (V1.5 = bouton + toast résumé final, pas streaming)
- Cron automatique (manual one-shot suffit)
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck</automated>
    Manual preview : login dirigeant → /admin/maintenance → cliquer bouton → toast résumé. Vérifier en BDD MCP lecture seule que pickup_lat est rempli pour quelques rides.
  </verify>
  <done>
    - Page /admin/maintenance dirigeant only
    - backfillRideGeocodingAction idempotent + rate-limit + audit log
    - Toast Sonner affiche résumé
  </done>
  <rollback>
    Supprimer `apps/web/src/app/(admin)/admin/maintenance/`. Les colonnes BDD restent peuplées (pas de rollback géocoding — chaque ride a juste plus de données, acceptable).
  </rollback>
</task>

</tasks>

<threat_model>
| Threat | Mitigation |
|---|---|
| T-04.7-10 Bypass migration via MCP | DEC-032 strict, code review |
| T-04.7-11 Backfill triggered par non-dirigeant | requireDirigeant + DEC-041 row count |
| T-04.7-12 Rate-limit BAN exceeded | sleep 1s/req, 200 rides max/run |
| T-04.7-13 Données coords incorrectes (lat/lng inversés) | Validation Zod future, V1.5 trust BAN |
</threat_model>

<verification>
1. Migration appliquée + CD vert + schema_migrations aligné
2. 6 colonnes visibles via MCP lecture seule
3. AddressOrPOIPicker propage coords (test manuel preview)
4. Server Actions persistent (test manuel preview)
5. backfillRideGeocodingAction opérationnel + audit log inséré
</verification>

<success_criteria>
- [ ] DEC-044 LOCKED dans PROJECT.md
- [ ] Migration géocoding mergée + CD vert
- [ ] Nouvelle course créée via UI persiste lat/lng/citycode
- [ ] Backfill une course existante depuis /admin/maintenance fonctionne
- [ ] Pas de capture preview obligatoire (T3 backend-heavy)
</success_criteria>

<output>
Créer `04.7-3-SUMMARY.md` après exécution.
</output>
