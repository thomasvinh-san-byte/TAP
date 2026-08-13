import { describe, it, expect } from 'vitest';
import { computeHistoriqueDiff, type PrevuRow, type RealiseRow } from './historique-diff';

function prevu(p: Partial<PrevuRow> & { ride_id: string }): PrevuRow {
  return { driver_id: 'd1', scheduled_at: '2026-06-15T06:00:00+04:00', status: 'assignee', ...p };
}
function realise(r: Partial<RealiseRow> & { id: string }): RealiseRow {
  return {
    driver_id: 'd1',
    status: 'assignee',
    scheduled_at: '2026-06-15T06:00:00+04:00',
    started_at: null,
    ...r,
  };
}

describe('computeHistoriqueDiff', () => {
  it('détecte une course ajoutée après validation', () => {
    const d = computeHistoriqueDiff(
      [prevu({ ride_id: 'a' })],
      [realise({ id: 'a' }), realise({ id: 'b' })],
    );
    expect(d.ajoutees.map((x) => x.ride_id)).toEqual(['b']);
  });

  it('détecte une course annulée après validation', () => {
    const d = computeHistoriqueDiff(
      [prevu({ ride_id: 'a' })],
      [realise({ id: 'a', status: 'annulee_patient' })],
    );
    expect(d.annulees.map((x) => x.ride_id)).toEqual(['a']);
    expect(d.ajoutees).toHaveLength(0);
  });

  it('compte une course de l’instantané disparue du réalisé comme annulée', () => {
    const d = computeHistoriqueDiff([prevu({ ride_id: 'a' })], []);
    expect(d.annulees.map((x) => x.ride_id)).toEqual(['a']);
  });

  it('détecte une réassignation (changement de chauffeur)', () => {
    const d = computeHistoriqueDiff(
      [prevu({ ride_id: 'a', driver_id: 'd1' })],
      [realise({ id: 'a', driver_id: 'd2' })],
    );
    expect(d.reassignees).toEqual([{ ride_id: 'a', from_driver_id: 'd1', to_driver_id: 'd2' }]);
  });

  it('ne compte un retard que si started_at dépasse le seuil', () => {
    const d = computeHistoriqueDiff(
      [prevu({ ride_id: 'a' }), prevu({ ride_id: 'b' })],
      [
        realise({ id: 'a', started_at: '2026-06-15T06:20:00+04:00' }), // +20 min
        realise({ id: 'b', started_at: '2026-06-15T06:10:00+04:00' }), // +10 min (< seuil)
      ],
    );
    expect(d.retards).toEqual([{ ride_id: 'a', minutes: 20 }]);
  });

  it('n’invente aucun retard sans started_at', () => {
    const d = computeHistoriqueDiff(
      [prevu({ ride_id: 'a' })],
      [realise({ id: 'a', started_at: null })],
    );
    expect(d.retards).toHaveLength(0);
  });
});
