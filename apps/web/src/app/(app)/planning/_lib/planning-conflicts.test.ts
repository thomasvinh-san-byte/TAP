import { describe, it, expect } from 'vitest';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { detectReassignConflict } from './planning-conflicts';

function ride(partial: Partial<CockpitRide> & { id: string }): CockpitRide {
  return {
    scheduled_at: '2026-05-04T06:00:00.000Z',
    status: 'assignee',
    pickup_address: 'Saint-Denis',
    dropoff_address: 'Le Tampon',
    driver_id: null,
    patient: null,
    driver: null,
    ...partial,
  } as CockpitRide;
}

describe('detectReassignConflict', () => {
  it('renvoie null si la cible est « non affectées » (désaffectation)', () => {
    const rides = [ride({ id: 'a', driver_id: null })];
    expect(detectReassignConflict(rides, 'a', null)).toBeNull();
  });

  it('renvoie null si le chauffeur cible n’a aucune course proche', () => {
    const rides = [
      ride({ id: 'a', scheduled_at: '2026-05-04T06:00:00.000Z' }),
      ride({ id: 'b', driver_id: 'd1', scheduled_at: '2026-05-04T10:00:00.000Z' }),
    ];
    expect(detectReassignConflict(rides, 'a', 'd1')).toBeNull();
  });

  it('signale un chevauchement probable dans la fenêtre (≤ 30 min)', () => {
    const rides = [
      ride({ id: 'a', scheduled_at: '2026-05-04T06:00:00.000Z' }),
      ride({ id: 'b', driver_id: 'd1', scheduled_at: '2026-05-04T06:20:00.000Z' }),
    ];
    const c = detectReassignConflict(rides, 'a', 'd1');
    expect(c).not.toBeNull();
    expect(c?.count).toBe(1);
    expect(c?.nearestScheduledAt).toBe('2026-05-04T06:20:00.000Z');
  });

  it('n’inclut jamais la course déplacée elle-même', () => {
    const rides = [ride({ id: 'a', driver_id: 'd1', scheduled_at: '2026-05-04T06:00:00.000Z' })];
    expect(detectReassignConflict(rides, 'a', 'd1')).toBeNull();
  });

  it('ignore les courses annulées du chauffeur cible', () => {
    const rides = [
      ride({ id: 'a', scheduled_at: '2026-05-04T06:00:00.000Z' }),
      ride({
        id: 'b',
        driver_id: 'd1',
        status: 'annulee_regulateur',
        scheduled_at: '2026-05-04T06:10:00.000Z',
      }),
    ];
    expect(detectReassignConflict(rides, 'a', 'd1')).toBeNull();
  });

  it('retient la course la plus proche quand plusieurs sont en conflit', () => {
    const rides = [
      ride({ id: 'a', scheduled_at: '2026-05-04T06:00:00.000Z' }),
      ride({ id: 'b', driver_id: 'd1', scheduled_at: '2026-05-04T06:25:00.000Z' }),
      ride({ id: 'c', driver_id: 'd1', scheduled_at: '2026-05-04T06:05:00.000Z' }),
    ];
    const c = detectReassignConflict(rides, 'a', 'd1');
    expect(c?.count).toBe(2);
    expect(c?.nearestScheduledAt).toBe('2026-05-04T06:05:00.000Z');
  });
});
