/**
 * Phase 06.23 (DEC-100) — Cas limites solveur heuristique.
 *
 * Tests CIBLÉS sur les branches non couvertes mesurées via
 * `pnpm exec vitest run --coverage` :
 *   - `preFilterRides` avec exactement 1 course (early return rides<=1).
 *   - extension à n>2 quand `places_assises >= 3` (lignes 250-262).
 *   - extension bloquée si capacity dépassée pendant l'extension.
 *   - course incompatible vehicle.type rejetée pendant l'extension.
 */

import { describe, it, expect } from 'vitest';
import type { SolveRequest } from '@tap/optimizer-client';
import { solveLocal } from './solve-local';

const UUID = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;

const DEPOT: [number, number] = [-20.8825, 55.4513];

function ride(
  id: string,
  scheduledAt: string,
  pickup: [number, number] = [-21.35, 55.47],
  dropoff: [number, number] = [-21.37, 55.49],
  transportMode: SolveRequest['rides'][number]['transport_mode'] = 'taxi_conventionne',
): SolveRequest['rides'][number] {
  return {
    id,
    pickup,
    dropoff,
    scheduled_at: scheduledAt,
    urgency: 'programmee',
    transport_mode: transportMode,
  };
}

function buildRequest(
  rides: SolveRequest['rides'],
  vehicles: SolveRequest['vehicles'],
): SolveRequest {
  return {
    contract_version: '1',
    date: '2026-05-22',
    rides,
    vehicles,
    depot: DEPOT,
    correction_factor: 1.3,
    avg_speed_kmh: 50,
    time_limit_seconds: 3,
  };
}

describe('solveLocal — cas limites (DEC-100)', () => {
  it('1 course seule → aucune paire formée, retourne rides_non_groupees_ids = [id]', () => {
    const req = buildRequest(
      [ride(UUID(1), '2026-05-22T04:00:00Z')],
      [{ id: UUID(0x101), type: 'taxi', places_assises: 4, places_tpmr: 0 }],
    );
    const res = solveLocal(req);
    expect(res.groupements).toHaveLength(0);
    expect(res.rides_non_groupees_ids).toEqual([UUID(1)]);
  });

  it('extension n=3 possible quand places_assises >= 3 et fenêtres compatibles', () => {
    const req = buildRequest(
      [
        ride(UUID(1), '2026-05-22T04:00:00Z'),
        ride(UUID(2), '2026-05-22T04:10:00Z'),
        ride(UUID(3), '2026-05-22T04:20:00Z'),
      ],
      [{ id: UUID(0x101), type: 'taxi', places_assises: 4, places_tpmr: 0 }],
    );
    const res = solveLocal(req);
    expect(res.groupements).toHaveLength(1);
    expect(res.groupements[0]!.ride_ids).toHaveLength(3);
    expect(new Set(res.groupements[0]!.ride_ids)).toEqual(new Set([UUID(1), UUID(2), UUID(3)]));
  });

  it('extension n bloquée si capacity dépassée (places_assises=3, 4 courses)', () => {
    const req = buildRequest(
      [
        ride(UUID(1), '2026-05-22T04:00:00Z'),
        ride(UUID(2), '2026-05-22T04:05:00Z'),
        ride(UUID(3), '2026-05-22T04:10:00Z'),
        ride(UUID(4), '2026-05-22T04:15:00Z'),
      ],
      [{ id: UUID(0x101), type: 'taxi', places_assises: 3, places_tpmr: 0 }],
    );
    const res = solveLocal(req);
    expect(res.groupements).toHaveLength(1);
    expect(res.groupements[0]!.ride_ids).toHaveLength(3);
    // 4ᵉ course mise de côté (capacity 3) — mais comme aucun autre véhicule
    // n'est libre, elle finit non groupée.
    expect(res.rides_non_groupees_ids).toContain(UUID(4));
  });

  it("extension rejette une course incompatible vehicle.type pendant l'extension", () => {
    // 3 courses dont la 3e est TPMR (incompatible véhicule taxi)
    const req = buildRequest(
      [
        ride(UUID(1), '2026-05-22T04:00:00Z'),
        ride(UUID(2), '2026-05-22T04:05:00Z'),
        ride(UUID(3), '2026-05-22T04:10:00Z', [-21.35, 55.47], [-21.37, 55.49], 'tpmr'),
      ],
      [{ id: UUID(0x101), type: 'taxi', places_assises: 5, places_tpmr: 0 }],
    );
    const res = solveLocal(req);
    expect(res.groupements).toHaveLength(1);
    // ride 3 TPMR rejetée à l'extension
    expect(res.groupements[0]!.ride_ids).toHaveLength(2);
    expect(res.rides_non_groupees_ids).toContain(UUID(3));
  });
});
