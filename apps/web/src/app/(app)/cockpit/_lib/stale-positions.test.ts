import { describe, it, expect } from 'vitest';
import { enServiceDriverIds, findStalePositionDrivers } from './stale-positions';
import type { CockpitRide } from './types';
import type { DriverPosition } from './use-driver-positions';

const NOW = new Date('2026-06-30T06:00:00Z').getTime();

function ride(over: Partial<CockpitRide>): CockpitRide {
  return {
    id: 'r',
    scheduled_at: '2026-06-30T06:00:00Z',
    status: 'assignee',
    pickup_address: 'A',
    dropoff_address: 'B',
    driver_id: 'd1',
    patient: null,
    driver: null,
    ...over,
  };
}

function pos(driver_id: string, capturedAt: string): DriverPosition {
  return {
    id: `p-${driver_id}`,
    driver_id,
    ride_id: null,
    lat: -21,
    lng: 55,
    accuracy: null,
    captured_at: capturedAt,
    source: 'demo',
  };
}

describe('enServiceDriverIds', () => {
  it('retient assignee et en_cours, ignore les autres statuts', () => {
    const ids = enServiceDriverIds([
      ride({ driver_id: 'a', status: 'assignee' }),
      ride({ driver_id: 'b', status: 'en_cours' }),
      ride({ driver_id: 'c', status: 'terminee' }),
      ride({ driver_id: 'd', status: 'validee' }),
      ride({ driver_id: null, status: 'assignee' }),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });
});

describe('findStalePositionDrivers', () => {
  it('alerte un chauffeur en service dont la position date de > 5 min', () => {
    const rides = [ride({ driver_id: 'd1', status: 'en_cours' })];
    const map = new Map([['d1', pos('d1', '2026-06-30T05:50:00Z')]]); // 10 min
    expect(findStalePositionDrivers(rides, map, NOW).map((s) => s.driver_id)).toEqual(['d1']);
  });

  it('n’alerte pas si la position est fraîche (< 5 min)', () => {
    const rides = [ride({ driver_id: 'd1', status: 'en_cours' })];
    const map = new Map([['d1', pos('d1', '2026-06-30T05:58:00Z')]]); // 2 min
    expect(findStalePositionDrivers(rides, map, NOW)).toEqual([]);
  });

  it('ANTI-FAUX-POSITIF : un chauffeur au repos avec position ancienne n’alerte pas', () => {
    const rides = [ride({ driver_id: 'd1', status: 'terminee' })];
    const map = new Map([['d1', pos('d1', '2026-06-30T04:00:00Z')]]); // 2 h
    expect(findStalePositionDrivers(rides, map, NOW)).toEqual([]);
  });

  it('alerte un chauffeur en service sans aucune position (captured_at null)', () => {
    const rides = [ride({ driver_id: 'd1', status: 'assignee' })];
    const res = findStalePositionDrivers(rides, new Map(), NOW);
    expect(res).toEqual([{ driver_id: 'd1', captured_at: null }]);
  });

  it('trie : aucune position d’abord, puis la plus ancienne', () => {
    const rides = [
      ride({ id: 'r1', driver_id: 'd1', status: 'en_cours' }),
      ride({ id: 'r2', driver_id: 'd2', status: 'en_cours' }),
      ride({ id: 'r3', driver_id: 'd3', status: 'en_cours' }),
    ];
    const map = new Map([
      ['d1', pos('d1', '2026-06-30T05:50:00Z')], // 10 min
      ['d3', pos('d3', '2026-06-30T05:40:00Z')], // 20 min
      // d2 : aucune position
    ]);
    expect(findStalePositionDrivers(rides, map, NOW).map((s) => s.driver_id)).toEqual([
      'd2',
      'd3',
      'd1',
    ]);
  });
});
