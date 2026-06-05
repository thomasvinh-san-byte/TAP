/**
 * Phase 06.23 (DEC-100) — Cas limites filet géocodage.
 *
 * Tests CIBLÉS sur les branches non couvertes (lignes 32, 41) :
 *   - coords fournies SANS citycode → citycode = null
 *   - BAN renvoie un résultat avec citycode vide → renvoyé null
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/geocoding/ban', () => ({
  geocodeBanSearch: vi.fn(),
}));

import { geocodeBanSearch } from '@/lib/geocoding/ban';
import { geocodeIfMissing } from './geocode-safety-net';

const geocodeMock = geocodeBanSearch as unknown as ReturnType<typeof vi.fn>;

describe('geocodeIfMissing — cas limites (DEC-100)', () => {
  beforeEach(() => {
    geocodeMock.mockReset();
  });

  it('coords fournies sans citycode → citycode résolu en null', async () => {
    const res = await geocodeIfMissing('12 rue de Paris', -20.88, 55.45, undefined);
    expect(res).toEqual({ lat: -20.88, lng: 55.45, citycode: null });
  });

  it('BAN renvoie un résultat avec citycode vide string → null', async () => {
    geocodeMock.mockResolvedValueOnce([
      {
        lat: -20.88,
        lng: 55.45,
        citycode: '',
        label: 'x',
        postcode: '97400',
        city: 'Saint-Denis',
        score: 0.9,
      },
    ]);
    const res = await geocodeIfMissing('Adresse sans citycode', null, null, null);
    expect(res).toEqual({ lat: -20.88, lng: 55.45, citycode: null });
  });
});
