import { describe, it, expect } from 'vitest';
import { computeDriverLoads } from './driver-load';
import type { CockpitRide } from './types';

function ride(over: Partial<CockpitRide>): CockpitRide {
  return {
    id: Math.random().toString(36).slice(2),
    scheduled_at: '2026-06-30T06:00:00Z',
    status: 'assignee',
    pickup_address: 'A',
    dropoff_address: 'B',
    driver_id: 'd1',
    patient: null,
    driver: { nom_affichage: 'Vergoz Jean' },
    ...over,
  };
}

describe('computeDriverLoads', () => {
  it('compte les courses affectées par chauffeur, triées décroissant', () => {
    const rides = [
      ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' } }),
      ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' }, status: 'en_cours' }),
      ride({ driver_id: 'd2', driver: { nom_affichage: 'Marie' }, status: 'terminee' }),
    ];
    const { loads, max } = computeDriverLoads(rides);
    expect(loads).toEqual([
      { driver_id: 'd1', nom: 'Jean', count: 2 },
      { driver_id: 'd2', nom: 'Marie', count: 1 },
    ]);
    expect(max).toBe(2);
  });

  it('ignore les courses sans driver_id (non affectées)', () => {
    const rides = [
      ride({ driver_id: null, status: 'validee' }),
      ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' } }),
    ];
    const { loads } = computeDriverLoads(rides);
    expect(loads).toEqual([{ driver_id: 'd1', nom: 'Jean', count: 1 }]);
  });

  it('ignore les statuts hors charge (brouillon, annulee)', () => {
    const rides = [
      ride({ driver_id: 'd1', status: 'annulee_regulateur' }),
      ride({ driver_id: 'd1', status: 'brouillon' }),
    ];
    expect(computeDriverLoads(rides)).toEqual({ loads: [], max: 0 });
  });

  it('max=0 si aucune course comptée (pas de division par zéro)', () => {
    expect(computeDriverLoads([])).toEqual({ loads: [], max: 0 });
  });

  it('complète le nom via driverLabels si la jointure driver manque', () => {
    const rides = [ride({ driver_id: 'd9', driver: null })];
    const { loads } = computeDriverLoads(rides, { d9: 'Boyer Sophie' });
    expect(loads[0]).toEqual({ driver_id: 'd9', nom: 'Boyer Sophie', count: 1 });
  });
});
