import { describe, it, expect } from 'vitest';
import { toIsoDate } from '@tap/recurrence';
import { selectMissingOccurrences } from './select-missing-occurrences';

const NOW = new Date('2026-06-15T00:00:00Z').getTime();

function d(iso: string): Date {
  return new Date(iso);
}

describe('selectMissingOccurrences', () => {
  it('exclut les occurrences passées', () => {
    const occ = [d('2026-06-10T08:00:00Z'), d('2026-06-20T08:00:00Z')];
    const res = selectMissingOccurrences(occ, new Set(), NOW);
    expect(res.map(toIsoDate)).toEqual(['2026-06-20']);
  });

  it('exclut les dates déjà matérialisées', () => {
    const occ = [d('2026-06-20T08:00:00Z'), d('2026-06-27T08:00:00Z')];
    const existing = new Set(['2026-06-20']);
    const res = selectMissingOccurrences(occ, existing, NOW);
    expect(res.map(toIsoDate)).toEqual(['2026-06-27']);
  });

  it('IDEMPOTENCE : 2e passe avec les dates créées → rien à générer', () => {
    const occ = [d('2026-06-20T08:00:00Z'), d('2026-06-27T08:00:00Z')];
    // 1re passe (rien d'existant)
    const first = selectMissingOccurrences(occ, new Set(), NOW);
    expect(first).toHaveLength(2);
    // 2e passe : les dates de la 1re passe sont désormais en base
    const existing = new Set(first.map(toIsoDate));
    const second = selectMissingOccurrences(occ, existing, NOW);
    expect(second).toEqual([]);
  });

  it('garde une occurrence pile à maintenant (>=)', () => {
    const occ = [d('2026-06-15T00:00:00Z')];
    expect(selectMissingOccurrences(occ, new Set(), NOW)).toHaveLength(1);
  });
});
