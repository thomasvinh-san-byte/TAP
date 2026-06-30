import { describe, it, expect } from 'vitest';
import {
  findUnassignedH1Rides,
  formatReunionTime,
  isUnassignedH1,
  minutesUntil,
} from './unassigned-h1';
import type { CockpitRide } from './types';

const NOW = new Date('2026-06-30T06:00:00Z').getTime();

function ride(over: Partial<CockpitRide>): CockpitRide {
  return {
    id: 'r1',
    scheduled_at: '2026-06-30T06:30:00Z',
    status: 'validee',
    pickup_address: 'A',
    dropoff_address: 'B',
    patient: { nom: 'Hoarau', prenom: 'Patrick' },
    driver: null,
    ...over,
  };
}

describe('minutesUntil', () => {
  it('compte les minutes signées jusqu’au créneau', () => {
    expect(minutesUntil('2026-06-30T06:30:00Z', NOW)).toBe(30);
    expect(minutesUntil('2026-06-30T05:30:00Z', NOW)).toBe(-30);
  });
});

describe('isUnassignedH1', () => {
  it('alerte une course validée dont le créneau est dans moins d’1 h', () => {
    expect(isUnassignedH1(ride({ scheduled_at: '2026-06-30T06:30:00Z' }), NOW)).toBe(true);
  });
  it('n’alerte pas au-delà d’1 h', () => {
    expect(isUnassignedH1(ride({ scheduled_at: '2026-06-30T07:30:00Z' }), NOW)).toBe(false);
  });
  it('n’alerte pas une course déjà affectée (assignee)', () => {
    expect(isUnassignedH1(ride({ status: 'assignee' }), NOW)).toBe(false);
  });
  it('alerte encore un créneau récemment passé (tolérance)', () => {
    expect(isUnassignedH1(ride({ scheduled_at: '2026-06-30T05:30:00Z' }), NOW)).toBe(true);
  });
  it('n’alerte plus un créneau largement passé', () => {
    expect(isUnassignedH1(ride({ scheduled_at: '2026-06-30T04:30:00Z' }), NOW)).toBe(false);
  });
});

describe('findUnassignedH1Rides', () => {
  it('ne retient que les concernées, triées par créneau le plus proche', () => {
    const rides = [
      ride({ id: 'late', scheduled_at: '2026-06-30T06:50:00Z' }),
      ride({ id: 'assigned', status: 'assignee', scheduled_at: '2026-06-30T06:10:00Z' }),
      ride({ id: 'soon', scheduled_at: '2026-06-30T06:10:00Z' }),
    ];
    expect(findUnassignedH1Rides(rides, NOW).map((r) => r.id)).toEqual(['soon', 'late']);
  });
});

describe('formatReunionTime', () => {
  it('formate en fuseau Réunion (UTC+4)', () => {
    expect(formatReunionTime('2026-06-30T06:00:00Z')).toBe('10:00');
  });
});
