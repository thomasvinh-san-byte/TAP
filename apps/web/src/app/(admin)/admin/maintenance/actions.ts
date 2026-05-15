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

const BAN_REUNION_LAT = -21.115;
const BAN_REUNION_LON = 55.536;
const REUNION_POSTCODE_PREFIX = '974';
const MIN_SCORE = 0.5;
const RATE_LIMIT_MS = 1000;
const MAX_PER_RUN = 200;

export interface BackfillResult {
  processed: number;
  skipped: number;
  errors: number;
  error?: string;
}

interface BanGeocode {
  lat: number;
  lng: number;
  citycode: string;
}

interface BanFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    postcode?: string;
    city?: string;
    citycode?: string;
    score?: number;
  };
}

interface BanResponse {
  features: BanFeature[];
}

interface RideRow {
  id: string;
  pickup_address: string;
  dropoff_address: string;
}

async function geocodeBan(address: string): Promise<BanGeocode | null> {
  if (!address || address.trim().length < 3) return null;
  try {
    const url = new URL('https://api-adresse.data.gouv.fr/search/');
    url.searchParams.set('q', address);
    url.searchParams.set('limit', '1');
    url.searchParams.set('lat', String(BAN_REUNION_LAT));
    url.searchParams.set('lon', String(BAN_REUNION_LON));
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const json = (await res.json()) as BanResponse;
    const f = json.features.find(
      (feat) =>
        feat.properties.postcode?.startsWith(REUNION_POSTCODE_PREFIX) &&
        (feat.properties.score ?? 0) >= MIN_SCORE,
    );
    if (!f) return null;
    return {
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      citycode: f.properties.citycode ?? '',
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
  const supabase = createClient();

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

  // Audit log unique pour traçabilité (DEC-029 esprit)
  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'maintenance.backfill_geocoding',
    entity_type: 'maintenance',
    entity_id: null,
    metadata: { processed, skipped, errors, max_per_run: MAX_PER_RUN },
  } as never);

  return { processed, skipped, errors };
}
