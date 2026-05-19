import { describe, it, expect } from 'vitest';
import { generateOccurrences } from '../generate-occurrences';
import { toIsoDate } from '../holidays-974';

describe('generateOccurrences', () => {
  it('produit ~12-13 occurrences pour weekly MWF sur 1 mois', () => {
    // dtstart = lundi 1 juin 2026 (jour de semaine = Monday).
    const dtstart = new Date('2026-06-01T08:00:00Z');
    const until = new Date('2026-07-01T08:00:00Z');
    const result = generateOccurrences({
      rruleStr: 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      dtstart,
      until,
      holidays974: new Set(),
    });
    // Juin 2026 contient 5 lundi/mer/ven => MWF = 13 ou 14 occurrences sur la période.
    expect(result.length).toBeGreaterThanOrEqual(12);
    expect(result.length).toBeLessThanOrEqual(14);
  });

  it('exclut les jours fériés 974 (14 juillet 2026)', () => {
    // 14 juillet 2026 = mardi. Récurrence quotidienne 13-15 juillet.
    const dtstart = new Date('2026-07-13T08:00:00Z');
    const until = new Date('2026-07-15T23:59:59Z');
    const result = generateOccurrences({
      rruleStr: 'RRULE:FREQ=DAILY',
      dtstart,
      until,
      holidays974: new Set(['2026-07-14']),
    });
    const isoDates = result.map(toIsoDate);
    expect(isoDates).toContain('2026-07-13');
    expect(isoDates).toContain('2026-07-15');
    expect(isoDates).not.toContain('2026-07-14');
    expect(result).toHaveLength(2);
  });

  it('exclut les excludedDates manuelles', () => {
    const dtstart = new Date('2026-06-01T08:00:00Z');
    const until = new Date('2026-06-05T23:59:59Z');
    const result = generateOccurrences({
      rruleStr: 'RRULE:FREQ=DAILY',
      dtstart,
      until,
      holidays974: new Set(),
      excludedDates: new Set(['2026-06-03']),
    });
    const isoDates = result.map(toIsoDate);
    expect(isoDates).not.toContain('2026-06-03');
    expect(result).toHaveLength(4);
  });

  it('fonctionne sans excludedDates (undefined)', () => {
    const dtstart = new Date('2026-06-01T08:00:00Z');
    const until = new Date('2026-06-03T23:59:59Z');
    const result = generateOccurrences({
      rruleStr: 'RRULE:FREQ=DAILY',
      dtstart,
      until,
      holidays974: new Set(),
    });
    expect(result).toHaveLength(3);
  });

  it('propage l erreur pour RRULE invalide', () => {
    expect(() =>
      generateOccurrences({
        rruleStr: 'INVALID_RRULE',
        dtstart: new Date('2026-06-01T08:00:00Z'),
        until: new Date('2026-07-01T08:00:00Z'),
        holidays974: new Set(),
      }),
    ).toThrow(/RRULE invalide/);
  });
});
