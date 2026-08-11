import { describe, it, expect } from 'vitest';
import { computeDriverLoads, computeDriverBalance, firstReassignableRideId } from './driver-load';
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

describe('computeDriverBalance', () => {
  const roster = [
    { id: 'd1', nom_affichage: 'Jean' },
    { id: 'd2', nom_affichage: 'Marie' },
    { id: 'd3', nom_affichage: 'Sophie' },
  ];

  it('inclut les chauffeurs actifs à 0 course (les plus disponibles)', () => {
    const rides = [
      ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' } }),
      ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' }, status: 'en_cours' }),
    ];
    const { entries, totalAssigned } = computeDriverBalance(rides, roster);
    expect(entries.map((e) => [e.nom, e.count])).toEqual([
      ['Jean', 2],
      ['Marie', 0],
      ['Sophie', 0],
    ]);
    expect(totalAssigned).toBe(2);
  });

  it('marque le plus chargé et les disponibles quand il y a déséquilibre', () => {
    const rides = [ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' } })];
    const { entries } = computeDriverBalance(rides, roster);
    const jean = entries.find((e) => e.driver_id === 'd1')!;
    const marie = entries.find((e) => e.driver_id === 'd2')!;
    expect(jean.isMostLoaded).toBe(true);
    expect(jean.isAvailable).toBe(false);
    expect(marie.isAvailable).toBe(true);
    expect(marie.isMostLoaded).toBe(false);
  });

  it('ne marque aucun extrême si la charge est équilibrée (égalité stricte)', () => {
    const rides = [
      ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' } }),
      ride({ driver_id: 'd2', driver: { nom_affichage: 'Marie' } }),
      ride({ driver_id: 'd3', driver: { nom_affichage: 'Sophie' } }),
    ];
    // Roster identique aux chargés : personne à 0, tout le monde à 1.
    const { entries } = computeDriverBalance(rides, roster);
    expect(entries.every((e) => !e.isMostLoaded && !e.isAvailable)).toBe(true);
  });

  it('sans roster, se comporte comme le comptage brut (aucun 0 ajouté)', () => {
    const rides = [ride({ driver_id: 'd1', driver: { nom_affichage: 'Jean' } })];
    const { entries } = computeDriverBalance(rides);
    expect(entries.map((e) => e.nom)).toEqual(['Jean']);
  });
});

describe('firstReassignableRideId', () => {
  it('renvoie la course assignee la plus tôt (réaffectable en priorité)', () => {
    const rides = [
      ride({ id: 'r-late', driver_id: 'd1', scheduled_at: '2026-06-30T10:00:00Z' }),
      ride({ id: 'r-early', driver_id: 'd1', scheduled_at: '2026-06-30T07:00:00Z' }),
      ride({
        id: 'r-done',
        driver_id: 'd1',
        scheduled_at: '2026-06-30T06:00:00Z',
        status: 'terminee',
      }),
    ];
    expect(firstReassignableRideId(rides, 'd1')).toBe('r-early');
  });

  it('à défaut d assignee, renvoie la course de charge la plus tôt', () => {
    const rides = [
      ride({
        id: 'r-enc',
        driver_id: 'd1',
        scheduled_at: '2026-06-30T09:00:00Z',
        status: 'en_cours',
      }),
      ride({
        id: 'r-done',
        driver_id: 'd1',
        scheduled_at: '2026-06-30T08:00:00Z',
        status: 'terminee',
      }),
    ];
    expect(firstReassignableRideId(rides, 'd1')).toBe('r-done');
  });

  it('renvoie null si le chauffeur n a aucune course (disponible)', () => {
    const rides = [ride({ driver_id: 'd2' })];
    expect(firstReassignableRideId(rides, 'd1')).toBeNull();
  });
});
