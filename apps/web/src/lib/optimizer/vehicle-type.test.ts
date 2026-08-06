import { describe, it, expect } from 'vitest';
import type { SolveRequest } from '@tap/optimizer-client';
import { solveLocal } from './solve-local';
import { MODE_TO_VEHICLE_TYPE, type VehicleDbType } from './vehicle-type';

/**
 * Verrouille la conversion du type de véhicule base → solveur (bug : un véhicule
 * stocké `taxi_conventionne` n'était pas converti vers `taxi`, donc jugé
 * incompatible avec les courses en taxi conventionné → aucun groupement).
 */

const UUID = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;

describe('MODE_TO_VEHICLE_TYPE — correspondance base → solveur', () => {
  it('convertit taxi_conventionne → taxi', () => {
    expect(MODE_TO_VEHICLE_TYPE.taxi_conventionne).toBe('taxi');
  });

  it('couvre toutes les valeurs de vehicles.type et laisse les autres inchangées', () => {
    // Toutes les valeurs possibles de la colonne base (CHECK migration vehicles).
    const dbTypes: VehicleDbType[] = ['taxi_conventionne', 'tpmr', 'vsl', 'ambulance'];
    expect(dbTypes.map((t) => MODE_TO_VEHICLE_TYPE[t])).toEqual([
      'taxi',
      'tpmr',
      'vsl',
      'ambulance',
    ]);
  });
});

describe('solveLocal — un véhicule taxi conventionné groupe des courses taxi conventionné', () => {
  it('propose un groupement une fois le type converti (régression du bug)', () => {
    // Véhicule stocké `taxi_conventionne` en base, converti pour le solveur via la
    // correspondance — exactement ce que fait readActiveVehicles côté optimiseur.
    const vehicleTypeForSolver = MODE_TO_VEHICLE_TYPE['taxi_conventionne'];

    const req: SolveRequest = {
      contract_version: '1',
      date: '2026-05-22',
      rides: [
        {
          id: UUID(1),
          pickup: [-21.35, 55.47],
          dropoff: [-21.37, 55.49],
          scheduled_at: '2026-05-22T04:00:00Z',
          urgency: 'programmee',
          transport_mode: 'taxi_conventionne',
        },
        {
          id: UUID(2),
          pickup: [-21.35, 55.47],
          dropoff: [-21.37, 55.49],
          scheduled_at: '2026-05-22T04:10:00Z',
          urgency: 'programmee',
          transport_mode: 'taxi_conventionne',
        },
      ],
      vehicles: [
        { id: UUID(0x101), type: vehicleTypeForSolver, places_assises: 4, places_tpmr: 0 },
      ],
      depot: [-20.8825, 55.4513],
      correction_factor: 1.3,
      avg_speed_kmh: 50,
      time_limit_seconds: 3,
    };

    const res = solveLocal(req);
    // Sans conversion, le véhicule arriverait en `taxi_conventionne`, absent de
    // COMPATIBILITY['taxi_conventionne'] = ['taxi'] → 0 groupement.
    expect(res.groupements).toHaveLength(1);
    expect(res.groupements[0]!.ride_ids).toHaveLength(2);
  });
});
