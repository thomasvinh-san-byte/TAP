import { describe, it, expect } from 'vitest';
import { computeTourneeIndicators, type TourneeIndicatorRow } from './tournee-indicators';

function row(p: Partial<TourneeIndicatorRow>): TourneeIndicatorRow {
  return {
    driver_id: 'd1',
    status: 'assignee',
    scheduled_at: '2026-05-04T06:00:00.000Z',
    ride_group_id: null,
    ...p,
  };
}

describe('computeTourneeIndicators', () => {
  it('compte les courses fermes et la plage horaire par chauffeur', () => {
    const ind = computeTourneeIndicators([
      row({ driver_id: 'd1', scheduled_at: '2026-05-04T06:00:00.000Z' }),
      row({ driver_id: 'd1', scheduled_at: '2026-05-04T09:30:00.000Z' }),
    ]).get('d1');
    expect(ind?.count).toBe(2);
    expect(ind?.firstAt).toBe('2026-05-04T06:00:00.000Z');
    expect(ind?.lastAt).toBe('2026-05-04T09:30:00.000Z');
  });

  it('exclut les courses non affectées et les statuts non fermes', () => {
    const map = computeTourneeIndicators([
      row({ driver_id: null }),
      row({ driver_id: 'd1', status: 'validee' }),
      row({ driver_id: 'd1', status: 'annulee_patient' }),
      row({ driver_id: 'd1', status: 'terminee' }),
    ]);
    expect(map.get('d1')?.count).toBe(1);
  });

  it('ne compte comme mutualisée qu’une course dans un groupe d’au moins 2', () => {
    const map = computeTourneeIndicators([
      row({ driver_id: 'd1', ride_group_id: 'g1' }),
      row({ driver_id: 'd1', ride_group_id: 'g1', scheduled_at: '2026-05-04T07:00:00.000Z' }),
      row({ driver_id: 'd1', ride_group_id: 'g2', scheduled_at: '2026-05-04T08:00:00.000Z' }),
    ]);
    const ind = map.get('d1');
    expect(ind?.count).toBe(3);
    expect(ind?.mutualisees).toBe(2); // g1 (taille 2) ; g2 seule → non mutualisée
    expect(ind?.tauxMutualisation).toBe(67);
  });

  it('renvoie une map vide sans course ferme', () => {
    expect(computeTourneeIndicators([row({ status: 'validee' })]).size).toBe(0);
  });
});
