/**
 * Construction du payload d'occurrences à INSERT depuis un template de
 * récurrence (Phase 05 Wave 3, étendu Phase 06.19 DEC-094).
 *
 * Pure : aucun effet de bord. Sépare la logique de transformation des
 * Server Actions pour la rendre testable sans mock Supabase.
 */

import type { GeocodeCoords } from '@/lib/geocoding/geocode-safety-net';

export type RecurrencePayloadInput = {
  patient_id: string;
  pickup_address: string;
  dropoff_address: string;
  transport_mode: 'vsl' | 'taxi_conventionne' | 'tpmr';
  urgency: 'normale' | 'prioritaire';
};

export type RecurrencePayloadCtx = {
  organizationId: string;
  userId: string;
};

/**
 * Construit le payload `rides[]` pour `supabase.from('rides').insert(...)`.
 * Propage les coords du template (`pickupCoords`/`dropoffCoords`) à chaque
 * occurrence pour alimenter `solveLocal` (06.12).
 */
export function buildRidesPayload(
  occurrences: Date[],
  recurrenceId: string,
  ctx: RecurrencePayloadCtx,
  input: RecurrencePayloadInput,
  pickupCoords: GeocodeCoords,
  dropoffCoords: GeocodeCoords,
): Record<string, unknown>[] {
  return occurrences.map((occ) => ({
    organization_id: ctx.organizationId,
    patient_id: input.patient_id,
    ride_recurrence_id: recurrenceId,
    pickup_address: input.pickup_address,
    dropoff_address: input.dropoff_address,
    pickup_lat: pickupCoords.lat,
    pickup_lng: pickupCoords.lng,
    pickup_citycode: pickupCoords.citycode,
    dropoff_lat: dropoffCoords.lat,
    dropoff_lng: dropoffCoords.lng,
    dropoff_citycode: dropoffCoords.citycode,
    transport_mode: input.transport_mode,
    urgency: input.urgency === 'prioritaire' ? 'urgente' : 'programmee',
    scheduled_at: occ.toISOString(),
    status: 'validee',
    created_by: ctx.userId,
  }));
}
