/**
 * Tests Vitest — propagation coords template → occurrences (DEC-094 Phase 06.19).
 *
 * Vérifie que `buildRidesPayload` copie correctement `pickup_lat/lng/citycode`
 * et `dropoff_*` du template de récurrence vers chaque occurrence générée.
 * C'est le pont entre le template (saisi avec picker) et `solveLocal` (06.12)
 * qui exclut tout `pickup_lat === null`.
 */

import { describe, it, expect } from 'vitest';
import { buildRidesPayload } from './build-rides-payload';

const CTX = { organizationId: 'org-1', userId: 'user-1' };
const INPUT = {
  patient_id: 'patient-1',
  pickup_address: 'Domicile',
  dropoff_address: 'Centre dialyse',
  transport_mode: 'vsl' as const,
  urgency: 'normale' as const,
};
const OCC1 = new Date('2026-06-08T08:00:00Z');
const OCC2 = new Date('2026-06-10T08:00:00Z');
const PICKUP = { lat: -20.88, lng: 55.45, citycode: '97411' };
const DROPOFF = { lat: -20.92, lng: 55.48, citycode: '97411' };

describe('buildRidesPayload — propagation coords template → occurrences (DEC-094)', () => {
  it('propage pickup_lat/lng/citycode + dropoff_* sur chaque occurrence', () => {
    const payload = buildRidesPayload([OCC1, OCC2], 'rec-1', CTX, INPUT, PICKUP, DROPOFF);
    expect(payload).toHaveLength(2);
    for (const row of payload) {
      expect(row.pickup_lat).toBe(-20.88);
      expect(row.pickup_lng).toBe(55.45);
      expect(row.pickup_citycode).toBe('97411');
      expect(row.dropoff_lat).toBe(-20.92);
      expect(row.dropoff_lng).toBe(55.48);
      expect(row.dropoff_citycode).toBe('97411');
      expect(row.ride_recurrence_id).toBe('rec-1');
      expect(row.organization_id).toBe('org-1');
      expect(row.created_by).toBe('user-1');
      expect(row.status).toBe('validee');
    }
  });

  it("propage des coords NULL si le template n'a pas été géocodé", () => {
    const empty = { lat: null, lng: null, citycode: null };
    const payload = buildRidesPayload([OCC1], 'rec-2', CTX, INPUT, empty, empty);
    expect(payload[0]!.pickup_lat).toBeNull();
    expect(payload[0]!.pickup_lng).toBeNull();
    expect(payload[0]!.dropoff_lat).toBeNull();
  });

  it('mappe urgency prioritaire → urgente (compat solveur urgency enum)', () => {
    const payload = buildRidesPayload(
      [OCC1],
      'rec-3',
      CTX,
      { ...INPUT, urgency: 'prioritaire' },
      PICKUP,
      DROPOFF,
    );
    expect(payload[0]!.urgency).toBe('urgente');
  });

  it('mappe urgency normale → programmee', () => {
    const payload = buildRidesPayload([OCC1], 'rec-4', CTX, INPUT, PICKUP, DROPOFF);
    expect(payload[0]!.urgency).toBe('programmee');
  });

  it("utilise scheduled_at = ISO de la Date d'occurrence", () => {
    const payload = buildRidesPayload([OCC1, OCC2], 'rec-5', CTX, INPUT, PICKUP, DROPOFF);
    expect(payload[0]!.scheduled_at).toBe(OCC1.toISOString());
    expect(payload[1]!.scheduled_at).toBe(OCC2.toISOString());
  });
});
