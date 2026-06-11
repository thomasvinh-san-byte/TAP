'use server';

/**
 * Server Action backfill géocoding rides (Phase 04.7 PLAN-3 T3.3, DEC-044).
 *
 * One-shot dirigeant : itère les rides sans coordonnées, appelle BAN
 * gouv.fr pour chacun, UPDATE rides avec pattern DEC-041 row count check.
 * Rate-limit 1 req/s pour rester poli vis-à-vis de l'API gratuite.
 * Audit log unique en fin de run.
 *
 * Limites V1.5 :
 *   - 200 rides max par run (à itérer plusieurs runs si volume)
 *   - Pas de toast progressbar streaming (résumé final via state client)
 *
 * Refs : DEC-044 LOCKED, DEC-041, DEC-032 (Server Action tracée).
 */

import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { createClient } from '@/lib/supabase/server';
import { geocodeBanSearch } from '@/lib/geocoding/ban';

const RATE_LIMIT_MS = 1000;
const MAX_PER_RUN = 200;

export interface BackfillResult {
  processed: number;
  skipped: number;
  errors: number;
  recurrences_processed?: number;
  error?: string;
}

interface BanGeocode {
  lat: number;
  lng: number;
  citycode: string;
}

interface RideRow {
  id: string;
  pickup_address: string;
  dropoff_address: string;
}

interface RecurrenceRow {
  id: string;
  pickup_address: string;
  dropoff_address: string;
}

async function geocodeBan(address: string): Promise<BanGeocode | null> {
  if (!address || address.trim().length < 3) return null;
  try {
    // Helper applique bias Réunion + filtre 974 + score >= 0.5 par défaut.
    // Phase 04.9-quater #120 : migration vers Géoplateforme IGN.
    const results = await geocodeBanSearch(address, { limit: 1 });
    const f = results[0];
    if (!f) return null;
    return {
      lat: f.lat,
      lng: f.lng,
      citycode: f.citycode,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function backfillRideGeocodingAction(): Promise<BackfillResult> {
  const ctx = await requireDirigeant();
  if (!ctx) {
    return {
      processed: 0,
      skipped: 0,
      errors: 0,
      error: 'Action réservée au dirigeant.',
    };
  }
  const supabase = await createClient();

  const target = await supabase
    .from('rides')
    .select('id, pickup_address, dropoff_address')
    .is('pickup_lat', null)
    .limit(MAX_PER_RUN);
  if (target.error) {
    return {
      processed: 0,
      skipped: 0,
      errors: 1,
      error: 'Lecture rides impossible.',
    };
  }

  const rides = (target.data ?? []) as RideRow[];
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const ride of rides) {
    const pickup = await geocodeBan(ride.pickup_address);
    await sleep(RATE_LIMIT_MS);
    const dropoff = await geocodeBan(ride.dropoff_address);
    await sleep(RATE_LIMIT_MS);

    if (!pickup && !dropoff) {
      skipped++;
      continue;
    }

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

    if (upd.error || !upd.data || upd.data.length === 0) {
      errors++;
      continue;
    }
    processed++;
  }

  // DEC-094 Phase 06.19 : étendre aux templates de récurrence sans coords.
  // Quand la récurrence est mise à jour, l'updateRecurrenceAction
  // régénère les rides futures avec les nouvelles coords — la cascade
  // reste maître. Ici on remplit uniquement le template.
  const recurrencesTarget = await supabase
    .from('ride_recurrences')
    .select('id, pickup_address, dropoff_address')
    .is('pickup_lat', null)
    .is('archived_at', null)
    .limit(MAX_PER_RUN);

  let recurrencesProcessed = 0;
  if (!recurrencesTarget.error && recurrencesTarget.data) {
    const recurrences = recurrencesTarget.data as unknown as RecurrenceRow[];
    for (const rec of recurrences) {
      const pickup = await geocodeBan(rec.pickup_address);
      await sleep(RATE_LIMIT_MS);
      const dropoff = await geocodeBan(rec.dropoff_address);
      await sleep(RATE_LIMIT_MS);
      if (!pickup && !dropoff) continue;
      const upd = await supabase
        .from('ride_recurrences')
        .update({
          pickup_lat: pickup?.lat ?? null,
          pickup_lng: pickup?.lng ?? null,
          pickup_citycode: pickup?.citycode ?? null,
          dropoff_lat: dropoff?.lat ?? null,
          dropoff_lng: dropoff?.lng ?? null,
          dropoff_citycode: dropoff?.citycode ?? null,
        } as never)
        .eq('id', rec.id)
        .select('id');
      if (!upd.error && upd.data && (upd.data as unknown[]).length > 0) {
        recurrencesProcessed++;
        // Propager aux occurrences futures non démarrées (cohérent avec
        // la cascade DEC-048 : pas de réécriture sur courses en cours /
        // terminées). Évite que les rides déjà générées restent NULL.
        const nowIso = new Date().toISOString();
        await supabase
          .from('rides')
          .update({
            pickup_lat: pickup?.lat ?? null,
            pickup_lng: pickup?.lng ?? null,
            pickup_citycode: pickup?.citycode ?? null,
            dropoff_lat: dropoff?.lat ?? null,
            dropoff_lng: dropoff?.lng ?? null,
            dropoff_citycode: dropoff?.citycode ?? null,
          } as never)
          .eq('ride_recurrence_id', rec.id)
          .in('status', ['validee', 'assignee'])
          .gt('scheduled_at', nowIso)
          .is('pickup_lat', null);
      }
    }
  }

  // Audit log unique pour traçabilité (DEC-029 esprit)
  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'maintenance.backfill_geocoding',
    entity_type: 'maintenance',
    entity_id: null,
    metadata: {
      processed,
      skipped,
      errors,
      recurrences_processed: recurrencesProcessed,
      max_per_run: MAX_PER_RUN,
    },
  } as never);

  return { processed, skipped, errors, recurrences_processed: recurrencesProcessed };
}

/**
 * Recalcul rétroactif des tarifs CGSS (Phase 05.5 Wave 4, DEC-060).
 *
 * Recalcule `tarif_amount_eur` des courses calculées automatiquement
 * (`tarif_source = 'cgss_auto'`) avec la grille tarifaire active, via
 * `computeCgssShortTrip` (packages/pricing).
 *
 * Garde-fous DEC-060 :
 *   - skip `tarif_source = 'manuel'` (saisies dirigeant volontaires)
 *   - skip `payment_status = 'encaisse'` (intégrité comptable)
 *
 * Refs : DEC-060, DEC-041 row count check, PRIC-04 audit_logs.
 */
export interface RecomputeTarifsResult {
  recomputed: number;
  candidates: number;
  error?: string;
}

interface TarifRideRow {
  id: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  scheduled_at: string;
  transport_mode: string;
}

export async function recomputeTarifsAction(): Promise<RecomputeTarifsResult> {
  const ctx = await requireDirigeant();
  if (!ctx) {
    return { recomputed: 0, candidates: 0, error: 'Action réservée au dirigeant.' };
  }

  const { getActiveTariffGrid, getHolidays974 } =
    await import('@/lib/pricing/get-active-tariff-grid');
  const { computeCgssShortTrip } = await import('@tap/pricing');
  const grid = await getActiveTariffGrid();
  if (!grid) {
    return {
      recomputed: 0,
      candidates: 0,
      error: 'Aucune grille tarifaire active configurée.',
    };
  }
  const holidays974 = new Set(await getHolidays974());

  const supabase = await createClient();
  // Cible : courses tarifées auto, NON encaissées (garde-fous DEC-060).
  // Les courses tarif_source = 'manuel' ne sont jamais sélectionnées.
  const target = await supabase
    .from('rides')
    .select(
      'id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, ' + 'scheduled_at, transport_mode',
    )
    .eq('tarif_source', 'cgss_auto')
    .neq('payment_status', 'encaisse');
  if (target.error) {
    return { recomputed: 0, candidates: 0, error: 'Lecture des courses impossible.' };
  }

  const rides = (target.data as TarifRideRow[] | null) ?? [];
  let recomputed = 0;
  for (const ride of rides) {
    const result = computeCgssShortTrip(
      {
        pickup_lat: ride.pickup_lat,
        pickup_lng: ride.pickup_lng,
        dropoff_lat: ride.dropoff_lat,
        dropoff_lng: ride.dropoff_lng,
        scheduled_at: ride.scheduled_at,
        transport_mode: ride.transport_mode as 'taxi_conventionne',
        holidays974,
      },
      grid,
    );
    // DEC-041 row count check + garde-fou encaissé répété sur l'UPDATE.
    const upd = await supabase
      .from('rides')
      .update({ tarif_amount_eur: result.total_eur } as never)
      .eq('id', ride.id)
      .neq('payment_status', 'encaisse')
      .select('id');
    if (!upd.error && upd.data && upd.data.length > 0) {
      recomputed++;
    }
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'maintenance.recompute_tarifs',
    entity_type: 'maintenance',
    entity_id: null,
    metadata: { recomputed, candidates: rides.length },
  } as never);

  return { recomputed, candidates: rides.length };
}
