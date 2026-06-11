import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { createClient } from '@/lib/supabase/server';
import { POSITION_MAX_ACCURACY_M, type DriverPositionInput } from '@tap/shared';

/**
 * Phase 10.0 prototype géoloc (DEC-096).
 *
 * Enregistre une position chauffeur si TOUS les garde-fous passent :
 *   1. flag applicatif `GEOLOC_ENABLED` = 'true' (pré-HDS = par défaut OFF
 *      en production, ON en preview démo). Tant que HDS pas en place,
 *      DEC-075 interdit la persistance de positions réelles.
 *   2. payload contient `lat`/`lng` (refus de permission = pointage OK
 *      sans position, jamais bloquant).
 *   3. `accuracy` <= `POSITION_MAX_ACCURACY_M` (100m) si fournie.
 *
 * Non bloquant : toute erreur d'INSERT est loggée mais NE FAIT PAS échouer
 * le pointage métier. Le pointage est la donnée canonique.
 */
export async function recordDriverPosition(opts: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  organizationId: string;
  driverId: string;
  rideId: string | null;
  source: 'event' | 'foreground';
  position: DriverPositionInput;
}): Promise<void> {
  const { supabase, organizationId, driverId, rideId, source, position } = opts;

  const enabled = process.env.GEOLOC_ENABLED === 'true';
  if (!enabled) return;

  if (position.lat == null || position.lng == null) return;
  if (position.accuracy != null && position.accuracy > POSITION_MAX_ACCURACY_M) return;

  const { error } = await supabase.from('driver_positions').insert({
    organization_id: organizationId,
    driver_id: driverId,
    ride_id: rideId,
    lat: position.lat,
    lng: position.lng,
    accuracy: position.accuracy ?? null,
    source,
    captured_at: new Date().toISOString(),
  } as never);

  if (error) {
    Sentry.captureException(error, { tags: { module: 'geoloc' } });
    console.error('[geoloc] recordDriverPosition error:', error.message);
  }
}
