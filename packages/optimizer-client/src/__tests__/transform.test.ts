import { describe, it, expect } from 'vitest';
import {
  ridesToSolveRequest,
  solveResponseToProposal,
  type RideRow,
  type VehicleRow,
} from '../transform';
import type { SolveResponse } from '../contract';
import { CONTRACT_VERSION } from '../contract';

// UUIDs constants pour les fixtures (sans nom propre — NFR-001)
const RIDE_ID_A = '11111111-1111-4111-a111-111111111111';
const RIDE_ID_B = '22222222-2222-4222-a222-222222222222';
const RIDE_ID_C = '33333333-3333-4333-a333-333333333333';
const RIDE_ID_D = '44444444-4444-4444-a444-444444444444';
const VEHICLE_ID = '55555555-5555-4555-a555-555555555555';

const DEFAULT_OPTS = {
  date: '2026-06-01',
  depot: [-20.88, 55.45] as [number, number],
  correctionFactor: 1.3,
  avgSpeedKmh: 50,
  timeLimitSeconds: 3,
};

/**
 * Fabrique une RideRow avec coordonnées valides par défaut.
 * Surcharges possibles pour tester les cas limites.
 */
function buildTestRide(overrides: Partial<RideRow> = {}): RideRow {
  return {
    id: RIDE_ID_A,
    scheduled_at: '2026-06-01T06:00:00+04:00',
    urgency: 'programmee',
    transport_mode: 'taxi_conventionne',
    pickup_lat: -20.8823,
    pickup_lng: 55.4504,
    dropoff_lat: -20.95,
    dropoff_lng: 55.55,
    pickup_citycode: '97411',
    dropoff_citycode: '97411',
    ...overrides,
  };
}

/** Fabrique un VehicleRow standard. */
function buildTestVehicle(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: VEHICLE_ID,
    type: 'taxi',
    places_assises: 4,
    places_tpmr: 0,
    ...overrides,
  };
}

describe('ridesToSolveRequest', () => {
  it('exclut les courses sans coordonnées et les remonte dans excluded', () => {
    const rideWithCoords = buildTestRide({ id: RIDE_ID_A });
    const rideWithoutCoords = buildTestRide({
      id: RIDE_ID_B,
      pickup_lat: null,
      pickup_lng: null,
    });

    const { payload, excluded } = ridesToSolveRequest(
      [rideWithCoords, rideWithoutCoords],
      [buildTestVehicle()],
      DEFAULT_OPTS,
    );

    expect(payload.rides).toHaveLength(1);
    expect(payload.rides[0]?.id).toBe(RIDE_ID_A);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toEqual({ id: RIDE_ID_B, reason: 'no_coordinates' });
  });

  it('exclut si dropoff_lat ou dropoff_lng est null', () => {
    const rideWithMissingDropoff = buildTestRide({
      id: RIDE_ID_C,
      dropoff_lat: null,
    });

    const { payload, excluded } = ridesToSolveRequest(
      [rideWithMissingDropoff],
      [buildTestVehicle()],
      DEFAULT_OPTS,
    );

    expect(payload.rides).toHaveLength(0);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.reason).toBe('no_coordinates');
  });

  it('ne produit jamais de PII dans le payload sérialisé (D-08)', () => {
    const rideWithCoords = buildTestRide({ id: RIDE_ID_A });
    const { payload } = ridesToSolveRequest([rideWithCoords], [buildTestVehicle()], DEFAULT_OPTS);

    const serialized = JSON.stringify(payload);

    // Aucune sous-chaîne patient / nom / nir ne doit apparaître (D-08)
    expect(serialized).not.toContain('patient');
    expect(serialized).not.toContain('nom');
    expect(serialized).not.toContain('nir');
  });

  it('mappe correctement urgency et transport_mode dans chaque RideNode', () => {
    const ride = buildTestRide({
      id: RIDE_ID_A,
      urgency: 'urgente',
      transport_mode: 'tpmr',
    });

    const { payload } = ridesToSolveRequest([ride], [buildTestVehicle()], DEFAULT_OPTS);

    expect(payload.rides[0]?.urgency).toBe('urgente');
    expect(payload.rides[0]?.transport_mode).toBe('tpmr');
  });

  it('inclut contract_version dans le payload assemblé', () => {
    const { payload } = ridesToSolveRequest([buildTestRide()], [buildTestVehicle()], DEFAULT_OPTS);
    expect(payload.contract_version).toBe(CONTRACT_VERSION);
  });
});

describe('solveResponseToProposal', () => {
  it('calcule tauxMutualisation = 50 pour 1 groupement de 2 courses sur 4 totales', () => {
    const response: SolveResponse = {
      contract_version: CONTRACT_VERSION,
      groupements: [
        {
          vehicle_id: VEHICLE_ID,
          ride_ids: [RIDE_ID_A, RIDE_ID_B],
          order: [RIDE_ID_A, RIDE_ID_B],
          motif: 'Trajets compatibles',
          gain_km_a_vide: 3.2,
        },
      ],
      rides_non_groupees_ids: [RIDE_ID_C, RIDE_ID_D],
      rides_exclues_ids: [],
      km_a_vide_estimes: 8.5,
    };

    const proposal = solveResponseToProposal(response, 4, []);
    expect(proposal.tauxMutualisation).toBe(50);
  });

  it("retourne tauxMutualisation = 0 quand il n'y a pas de groupement", () => {
    const response: SolveResponse = {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: [RIDE_ID_A, RIDE_ID_B],
      rides_exclues_ids: [],
      km_a_vide_estimes: 0,
    };

    const proposal = solveResponseToProposal(response, 2, []);
    expect(proposal.tauxMutualisation).toBe(0);
  });

  it('retourne tauxMutualisation = 0 quand totalRides est 0 (évite division par zéro)', () => {
    const response: SolveResponse = {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: [],
      rides_exclues_ids: [],
      km_a_vide_estimes: 0,
    };

    const proposal = solveResponseToProposal(response, 0, []);
    expect(proposal.tauxMutualisation).toBe(0);
  });

  it('intègre les courses exclues dans la proposition', () => {
    const response: SolveResponse = {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: [],
      rides_exclues_ids: [],
      km_a_vide_estimes: 0,
    };
    const excluded = [{ id: RIDE_ID_C, reason: 'no_coordinates' as const }];

    const proposal = solveResponseToProposal(response, 1, excluded);
    expect(proposal.excludedRides).toHaveLength(1);
    expect(proposal.excludedRides[0]?.id).toBe(RIDE_ID_C);
  });

  it('reporte kmAVideEstimes depuis la réponse solveur', () => {
    const response: SolveResponse = {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: [],
      rides_exclues_ids: [],
      km_a_vide_estimes: 42.7,
    };

    const proposal = solveResponseToProposal(response, 0, []);
    expect(proposal.kmAVideEstimes).toBe(42.7);
  });
});
