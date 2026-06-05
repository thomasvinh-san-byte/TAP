import { describe, it, expect } from 'vitest';
import { formatPositionAge, positionTone } from './use-driver-positions';

const NOW = new Date('2026-06-05T10:00:00Z');
// Espace insécable français (U+00A0) — utilisé devant les unités
// (« 3 j », « 17 min ») dans le helper pour la typographie 974.
const NBSP = ' ';

describe('formatPositionAge — honnêteté temporelle (DEC-096)', () => {
  it('renvoie « vu à l’instant » pour <1 min', () => {
    const t = new Date(NOW.getTime() - 30_000).toISOString();
    expect(formatPositionAge(t, NOW)).toBe('vu à l’instant');
  });

  it('renvoie « vu il y a Xmin » pour <1h', () => {
    const t = new Date(NOW.getTime() - 17 * 60_000).toISOString();
    expect(formatPositionAge(t, NOW)).toBe(`vu il y a 17${NBSP}min`);
  });

  it('renvoie « vu il y a Xh » pour <24h', () => {
    const t = new Date(NOW.getTime() - 2 * 3600_000 - 5 * 60_000).toISOString();
    expect(formatPositionAge(t, NOW)).toBe(`vu il y a 2${NBSP}h05`);
  });

  it('renvoie « vu il y a Xj » pour ≥24h', () => {
    const t = new Date(NOW.getTime() - 3 * 86400_000).toISOString();
    expect(formatPositionAge(t, NOW)).toBe(`vu il y a 3${NBSP}j`);
  });
});

describe('positionTone — fraîcheur visuelle', () => {
  it('primary si < 5 minutes', () => {
    const t = new Date(NOW.getTime() - 60_000).toISOString();
    expect(positionTone(t, NOW)).toBe('primary');
  });

  it('muted si ≥ 5 minutes', () => {
    const t = new Date(NOW.getTime() - 10 * 60_000).toISOString();
    expect(positionTone(t, NOW)).toBe('muted');
  });
});
