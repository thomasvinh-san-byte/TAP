/**
 * Tests Vitest — filet serveur de géocodage Phase 06.19 (DEC-094).
 *
 * On teste la fonction pure `geocodeIfMissing` exposée via un module
 * helper séparé (ré-importée dans recurrences.ts et create.ts) pour
 * éviter les mocks de Server Action complets.
 *
 * Scénarios :
 *   1. Court-circuit idempotent — si coords déjà fournies, pas d'appel BAN.
 *   2. BAN renvoie un résultat → coords + citycode persistés.
 *   3. BAN renvoie 0 résultat → coords NULL (non bloquant).
 *   4. BAN throw → coords NULL (non bloquant, jamais re-throw).
 *   5. Adresse vide → coords NULL sans appel BAN.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/geocoding/ban', () => ({
  geocodeBanSearch: vi.fn(),
}));

import { geocodeBanSearch } from '@/lib/geocoding/ban';
import { geocodeIfMissing } from './geocode-safety-net';

const geocodeMock = geocodeBanSearch as unknown as ReturnType<typeof vi.fn>;

describe('geocodeIfMissing — filet serveur géocodage', () => {
  beforeEach(() => {
    geocodeMock.mockReset();
  });

  it("court-circuit si coords déjà fournies (pas d'appel BAN)", async () => {
    const res = await geocodeIfMissing('12 rue de Paris', -20.88, 55.45, '97411');
    expect(res).toEqual({ lat: -20.88, lng: 55.45, citycode: '97411' });
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it('persiste le 1er résultat BAN si coords absentes', async () => {
    geocodeMock.mockResolvedValueOnce([
      {
        lat: -20.88,
        lng: 55.45,
        citycode: '97411',
        label: 'x',
        postcode: '97400',
        city: 'y',
        score: 0.9,
      },
    ]);
    const res = await geocodeIfMissing('CHU Saint-Denis', null, null, null);
    expect(res).toEqual({ lat: -20.88, lng: 55.45, citycode: '97411' });
    expect(geocodeMock).toHaveBeenCalledTimes(1);
  });

  it('renvoie NULL si BAN 0 résultat (non bloquant)', async () => {
    geocodeMock.mockResolvedValueOnce([]);
    const res = await geocodeIfMissing('adresse improbable', null, null, null);
    expect(res).toEqual({ lat: null, lng: null, citycode: null });
  });

  it('renvoie NULL si BAN throw (non bloquant)', async () => {
    geocodeMock.mockRejectedValueOnce(new Error('Géoplateforme unavailable (HTTP 503)'));
    const res = await geocodeIfMissing('CHU Saint-Denis', null, null, null);
    expect(res).toEqual({ lat: null, lng: null, citycode: null });
  });

  it('renvoie NULL sans appel BAN si adresse vide ou trop courte', async () => {
    const r1 = await geocodeIfMissing('', null, null, null);
    const r2 = await geocodeIfMissing('  ', null, null, null);
    const r3 = await geocodeIfMissing('ab', null, null, null);
    expect(r1).toEqual({ lat: null, lng: null, citycode: null });
    expect(r2).toEqual({ lat: null, lng: null, citycode: null });
    expect(r3).toEqual({ lat: null, lng: null, citycode: null });
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it('court-circuit si seul lat est fourni (pas de coord partielle valide)', async () => {
    geocodeMock.mockResolvedValueOnce([]);
    const res = await geocodeIfMissing('CHU Saint-Denis', -20.88, null, null);
    // lat sans lng = considéré incomplet → tentative BAN
    expect(res).toEqual({ lat: null, lng: null, citycode: null });
    expect(geocodeMock).toHaveBeenCalledTimes(1);
  });
});
