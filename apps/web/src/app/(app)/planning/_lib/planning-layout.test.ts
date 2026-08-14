import { describe, it, expect } from 'vitest';
import {
  reunionHour,
  computeHourRange,
  hourSlots,
  reunionHourMinute,
  nowColumnFraction,
} from './planning-layout';

// La CI Vitest tourne en TZ Indian/Reunion (UTC+4) — cf. vitest.config.ts.
// 06:30 UTC = 10:30 Réunion ; 22:00 UTC = 02:00 (lendemain) Réunion.
describe('reunionHour', () => {
  it('extrait l’heure en fuseau Réunion (UTC+4)', () => {
    expect(reunionHour('2026-05-04T06:30:00.000Z')).toBe(10);
    expect(reunionHour('2026-05-04T00:00:00.000Z')).toBe(4);
  });

  it('renvoie -1 pour un horodatage invalide', () => {
    expect(reunionHour('pas-une-date')).toBe(-1);
  });
});

describe('computeHourRange', () => {
  it('couvre au moins 7 h → 18 h sur une entrée vide', () => {
    expect(computeHourRange([])).toEqual({ start: 7, end: 18 });
  });

  it('étend la plage pour englober une course matinale et tardive (+1 h de marge)', () => {
    // 01:00 UTC = 05:00 Réunion ; 15:00 UTC = 19:00 Réunion → end = 20.
    const range = computeHourRange(['2026-05-04T01:00:00.000Z', '2026-05-04T15:00:00.000Z']);
    expect(range.start).toBe(5);
    expect(range.end).toBe(20);
  });

  it('reste borné à 23 h', () => {
    // 20:00 UTC = 00:00 (lendemain) Réunion = 0 → n’étend pas au-delà de 18 côté fin.
    const range = computeHourRange(['2026-05-04T13:00:00.000Z']); // 17 h Réunion
    expect(range.end).toBe(18);
  });
});

describe('hourSlots', () => {
  it('liste les heures-colonnes bornes incluses', () => {
    expect(hourSlots({ start: 7, end: 10 })).toEqual([7, 8, 9, 10]);
  });
});

describe('reunionHourMinute', () => {
  it('extrait heure et minute en fuseau Réunion (UTC+4)', () => {
    // 06:15 UTC = 10:15 Réunion.
    expect(reunionHourMinute('2026-05-04T06:15:00.000Z')).toEqual({ hour: 10, minute: 15 });
  });

  it('renvoie null pour un horodatage invalide', () => {
    expect(reunionHourMinute('pas-une-date')).toBeNull();
  });
});

describe('nowColumnFraction', () => {
  const slots = [7, 8, 9, 10, 11, 12];

  it('place le repère à la fraction de colonne (heure + minute)', () => {
    expect(nowColumnFraction(slots, 7, 0)).toBe(0);
    expect(nowColumnFraction(slots, 7, 30)).toBe(0.5);
    expect(nowColumnFraction(slots, 9, 15)).toBeCloseTo(2.25, 5);
    expect(nowColumnFraction(slots, 12, 0)).toBe(5);
  });

  it('renvoie null hors de la plage affichée (avant ou après)', () => {
    expect(nowColumnFraction(slots, 6, 30)).toBeNull();
    expect(nowColumnFraction(slots, 13, 0)).toBeNull();
    expect(nowColumnFraction([], 9, 0)).toBeNull();
  });
});
