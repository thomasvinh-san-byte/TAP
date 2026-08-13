import { describe, it, expect } from 'vitest';
import { reunionHour, computeHourRange, hourSlots } from './planning-layout';

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
