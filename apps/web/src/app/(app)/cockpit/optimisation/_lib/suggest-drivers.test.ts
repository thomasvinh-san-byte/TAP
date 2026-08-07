import { describe, it, expect } from 'vitest';
import { suggestDriversForGroupements } from './suggest-drivers';

const T = (h: number): number => new Date(`2026-08-06T0${h}:00:00Z`).getTime();

describe('suggestDriversForGroupements — règle simple, déterministe', () => {
  it('répartit de façon équilibrée deux tournées non chevauchantes sur deux chauffeurs', () => {
    const out = suggestDriversForGroupements(
      [
        { key: 'gA', startMs: T(6), endMs: T(7) },
        { key: 'gB', startMs: T(8), endMs: T(9) },
      ],
      [{ id: 'd1' }, { id: 'd2' }],
    );
    // Chacune un chauffeur distinct (équilibrage : le moins chargé ensuite).
    expect(out.gA).not.toBeNull();
    expect(out.gB).not.toBeNull();
    expect(out.gA).not.toBe(out.gB);
  });

  it('n’affecte jamais deux tournées qui se CHEVAUCHENT au même chauffeur', () => {
    const out = suggestDriversForGroupements(
      [
        { key: 'gA', startMs: T(6), endMs: T(8) },
        { key: 'gB', startMs: T(7), endMs: T(9) }, // chevauche gA
      ],
      [{ id: 'd1' }, { id: 'd2' }],
    );
    expect(out.gA).not.toBe(out.gB);
  });

  it('laisse un groupement NON affecté si aucun chauffeur libre (chevauchement, 1 seul chauffeur)', () => {
    const out = suggestDriversForGroupements(
      [
        { key: 'gA', startMs: T(6), endMs: T(8) },
        { key: 'gB', startMs: T(7), endMs: T(9) },
      ],
      [{ id: 'd1' }],
    );
    expect(out.gA).toBe('d1');
    expect(out.gB).toBeNull(); // pas d'affectation à vide
  });

  it('aucun chauffeur → tous les groupements non affectés', () => {
    const out = suggestDriversForGroupements([{ key: 'gA', startMs: T(6), endMs: T(7) }], []);
    expect(out.gA).toBeNull();
  });

  it('est déterministe : mêmes entrées → même sortie', () => {
    const groups = [
      { key: 'gB', startMs: T(8), endMs: T(9) },
      { key: 'gA', startMs: T(6), endMs: T(7) },
    ];
    const drivers = [{ id: 'd2' }, { id: 'd1' }];
    expect(suggestDriversForGroupements(groups, drivers)).toEqual(
      suggestDriversForGroupements(groups, drivers),
    );
  });
});
