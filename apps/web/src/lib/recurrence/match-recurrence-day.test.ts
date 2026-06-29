import { describe, it, expect } from 'vitest';
import {
  recurrenceFallsOnDay,
  reunionDateString,
  type RecurrenceDayInput,
} from './match-recurrence-day';

/**
 * Tests EXPRESS-02 (§5.8) — détection PURE qu'une récurrence tombe le jour
 * (Réunion) d'une saisie : match, exception, hors plage, fuseau UTC+4.
 */

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Jour RRULE (BYDAY) de la date ISO donnée. */
function bydayOf(isoDate: string): string {
  return DAYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()]!;
}

const TARGET = '2026-06-12';
// 10 h Réunion le jour cible (06 h UTC) — même jour Réunion.
const SCHEDULED = new Date(`${TARGET}T06:00:00Z`);
const NO_HOLIDAYS = new Set<string>();

function weeklyRec(overrides: Partial<RecurrenceDayInput> = {}): RecurrenceDayInput {
  return {
    rruleStr: `FREQ=WEEKLY;BYDAY=${bydayOf(TARGET)};BYHOUR=8;BYMINUTE=0`,
    startDate: '2026-05-01',
    endDate: null,
    excludedDates: new Set<string>(),
    holidays974: NO_HOLIDAYS,
    ...overrides,
  };
}

describe('recurrenceFallsOnDay', () => {
  it('récurrence hebdo qui tombe le jour saisi → matchée', () => {
    expect(recurrenceFallsOnDay(weeklyRec(), SCHEDULED)).toBe(true);
  });

  it('occurrence du jour dans les exceptions → NON matchée', () => {
    const rec = weeklyRec({ excludedDates: new Set([TARGET]) });
    expect(recurrenceFallsOnDay(rec, SCHEDULED)).toBe(false);
  });

  it('le jour saisi est férié → NON matchée', () => {
    const rec = weeklyRec({ holidays974: new Set([TARGET]) });
    expect(recurrenceFallsOnDay(rec, SCHEDULED)).toBe(false);
  });

  it('récurrence qui démarre APRÈS le jour saisi → NON matchée', () => {
    expect(recurrenceFallsOnDay(weeklyRec({ startDate: '2026-07-01' }), SCHEDULED)).toBe(false);
  });

  it('récurrence terminée AVANT le jour saisi → NON matchée', () => {
    expect(recurrenceFallsOnDay(weeklyRec({ endDate: '2026-06-01' }), SCHEDULED)).toBe(false);
  });

  it('récurrence un autre jour de la semaine → NON matchée', () => {
    const otherDay = bydayOf('2026-06-13'); // lendemain
    const rec = weeklyRec({ rruleStr: `FREQ=WEEKLY;BYDAY=${otherDay};BYHOUR=8;BYMINUTE=0` });
    expect(recurrenceFallsOnDay(rec, SCHEDULED)).toBe(false);
  });
});

describe('reunionDateString — fuseau UTC+4 (pas de débordement)', () => {
  it('22 h Réunion le 12 (18 h UTC) reste le 12', () => {
    expect(reunionDateString(new Date('2026-06-12T18:00:00Z'))).toBe('2026-06-12');
  });

  it('00 h Réunion le 13 (20 h UTC le 12) bascule au 13', () => {
    expect(reunionDateString(new Date('2026-06-12T20:00:00Z'))).toBe('2026-06-13');
  });

  it('saisie 22 h Réunion ne matche pas une récurrence du lendemain', () => {
    // Instant = 22 h Réunion le 12 → jour cible 12 ; récurrence le 13 → pas de match.
    const recLendemain = weeklyRec({
      rruleStr: `FREQ=WEEKLY;BYDAY=${bydayOf('2026-06-13')};BYHOUR=8;BYMINUTE=0`,
    });
    expect(recurrenceFallsOnDay(recLendemain, new Date('2026-06-12T18:00:00Z'))).toBe(false);
  });
});
