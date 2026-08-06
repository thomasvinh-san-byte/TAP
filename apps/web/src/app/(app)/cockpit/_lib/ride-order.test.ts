import { describe, it, expect } from 'vitest';
import { chronologicalOrder, isRideDone } from './ride-order';
import type { CockpitRide } from './types';

function ride(over: Partial<CockpitRide>): CockpitRide {
  return {
    id: 'x',
    scheduled_at: '2026-05-22T06:00:00Z',
    status: 'validee',
    pickup_address: 'A',
    dropoff_address: 'B',
    driver_id: null,
    patient: null,
    driver: null,
    ...over,
  };
}

describe('chronologicalOrder — numéroter les courses actives par heure', () => {
  it('numérote 1, 2, 3 dans l’ordre des heures programmées (indépendant de l’ordre d’entrée)', () => {
    const order = chronologicalOrder([
      ride({ id: 'midi', scheduled_at: '2026-05-22T12:00:00Z' }),
      ride({ id: 'tot', scheduled_at: '2026-05-22T06:30:00Z' }),
      ride({ id: 'matin', scheduled_at: '2026-05-22T09:00:00Z' }),
    ]);
    expect(order.get('tot')).toBe(1);
    expect(order.get('matin')).toBe(2);
    expect(order.get('midi')).toBe(3);
  });

  it('exclut les courses terminées et ne décale pas la numérotation des actives', () => {
    const order = chronologicalOrder([
      ride({ id: 'faite', scheduled_at: '2026-05-22T05:00:00Z', status: 'terminee' }),
      ride({ id: 'a', scheduled_at: '2026-05-22T07:00:00Z' }),
      ride({ id: 'b', scheduled_at: '2026-05-22T08:00:00Z' }),
    ]);
    // La terminée (pourtant la plus tôt) n'a pas de numéro…
    expect(order.has('faite')).toBe(false);
    // …et les actives restent numérotées 1, 2 (pas 2, 3).
    expect(order.get('a')).toBe(1);
    expect(order.get('b')).toBe(2);
  });
});

describe('isRideDone', () => {
  it('vrai seulement pour le statut terminé', () => {
    expect(isRideDone({ status: 'terminee' })).toBe(true);
    expect(isRideDone({ status: 'en_cours' })).toBe(false);
    expect(isRideDone({ status: 'validee' })).toBe(false);
  });
});
