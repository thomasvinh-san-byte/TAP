import { describe, it, expect } from 'vitest';
import { SolveRequestSchema, SolveResponseSchema, CONTRACT_VERSION } from '../contract';

// UUID constants pour les fixtures (sans nom propre — NFR-001)
const RIDE_ID_A = '11111111-1111-4111-a111-111111111111';
const RIDE_ID_B = '22222222-2222-4222-a222-222222222222';
const VEHICLE_ID = '33333333-3333-4333-a333-333333333333';

const validRide = {
  id: RIDE_ID_A,
  pickup: [-20.8823, 55.4504] as [number, number],
  dropoff: [-20.95, 55.55] as [number, number],
  scheduled_at: '2026-06-01T06:00:00+04:00',
  urgency: 'programmee' as const,
  transport_mode: 'taxi_conventionne' as const,
};

const validVehicle = {
  id: VEHICLE_ID,
  type: 'taxi' as const,
  places_assises: 4,
  places_tpmr: 0,
};

const validRequest = {
  contract_version: '1' as const,
  date: '2026-06-01',
  rides: [validRide],
  vehicles: [validVehicle],
  depot: [-20.88, 55.45] as [number, number],
  correction_factor: 1.3,
  avg_speed_kmh: 50,
  time_limit_seconds: 3,
};

const validResponse = {
  contract_version: '1' as const,
  groupements: [],
  rides_non_groupees_ids: [RIDE_ID_A],
  rides_exclues_ids: [],
  km_a_vide_estimes: 12.5,
};

describe('SolveRequestSchema', () => {
  it('rejette un payload sans contract_version', () => {
    const { contract_version: _cv, ...withoutVersion } = validRequest;
    const result = SolveRequestSchema.safeParse(withoutVersion);
    expect(result.success).toBe(false);
  });

  it('accepte un payload valide minimal', () => {
    const result = SolveRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it('rejette contract_version "2" (dérive de version détectée)', () => {
    const result = SolveRequestSchema.safeParse({
      ...validRequest,
      contract_version: '2',
    });
    expect(result.success).toBe(false);
  });
});

describe('SolveResponseSchema', () => {
  it('accepte une réponse valide et roundtrip correct', () => {
    const result = SolveResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contract_version).toBe(CONTRACT_VERSION);
      expect(result.data.km_a_vide_estimes).toBe(12.5);
    }
  });

  it('rejette une réponse avec contract_version "2"', () => {
    const result = SolveResponseSchema.safeParse({
      ...validResponse,
      contract_version: '2',
    });
    expect(result.success).toBe(false);
  });

  it('rejette une réponse sans contract_version', () => {
    const { contract_version: _cv, ...withoutVersion } = validResponse;
    const result = SolveResponseSchema.safeParse(withoutVersion);
    expect(result.success).toBe(false);
  });

  it('rejette un groupement avec un seul ride_id (min 2 requis)', () => {
    const responseWithBadGroupement = {
      ...validResponse,
      groupements: [
        {
          vehicle_id: VEHICLE_ID,
          ride_ids: [RIDE_ID_A],
          order: [RIDE_ID_A],
          motif: 'test',
          gain_km_a_vide: 0,
        },
      ],
    };
    const result = SolveResponseSchema.safeParse(responseWithBadGroupement);
    expect(result.success).toBe(false);
  });
});
