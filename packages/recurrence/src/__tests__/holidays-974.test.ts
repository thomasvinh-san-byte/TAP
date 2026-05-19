import { describe, it, expect } from 'vitest';
import { isHoliday974, toIsoDate } from '../holidays-974';

describe('isHoliday974', () => {
  it('renvoie true quand la date est dans le set', () => {
    const holidays = new Set(['2026-07-14']);
    expect(isHoliday974(new Date('2026-07-14T08:00:00Z'), holidays)).toBe(true);
  });

  it('renvoie false quand la date n est pas dans le set', () => {
    const holidays = new Set(['2026-07-14']);
    expect(isHoliday974(new Date('2026-07-15T08:00:00Z'), holidays)).toBe(false);
  });
});

describe('toIsoDate', () => {
  it('extrait le YYYY-MM-DD UTC', () => {
    expect(toIsoDate(new Date('2026-12-20T23:59:59Z'))).toBe('2026-12-20');
  });
});
