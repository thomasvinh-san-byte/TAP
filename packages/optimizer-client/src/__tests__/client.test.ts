import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { solve, OptimizerError } from '../client';
import type { SolveRequest, SolveResponse } from '../contract';
import { CONTRACT_VERSION } from '../contract';

const RIDE_ID = '11111111-1111-4111-a111-111111111111';
const VEHICLE_ID = '33333333-3333-4333-a333-333333333333';

const validRequest: SolveRequest = {
  contract_version: '1',
  date: '2026-06-01',
  rides: [
    {
      id: RIDE_ID,
      pickup: [-20.8823, 55.4504],
      dropoff: [-20.95, 55.55],
      scheduled_at: '2026-06-01T06:00:00+04:00',
      urgency: 'programmee',
      transport_mode: 'taxi_conventionne',
    },
  ],
  vehicles: [
    {
      id: VEHICLE_ID,
      type: 'taxi',
      places_assises: 4,
      places_tpmr: 0,
    },
  ],
  depot: [-20.88, 55.45],
  correction_factor: 1.3,
  avg_speed_kmh: 50,
  time_limit_seconds: 3,
};

const validResponse: SolveResponse = {
  contract_version: CONTRACT_VERSION,
  groupements: [],
  rides_non_groupees_ids: [RIDE_ID],
  rides_exclues_ids: [],
  km_a_vide_estimes: 0,
};

const BASE_OPTIONS = { baseUrl: 'http://optimizer.local', timeoutMs: 5000 };

describe('solve()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retourne la SolveResponse parsée quand le service répond correctement', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(validResponse), { status: 200 }),
    );

    const result = await solve(validRequest, BASE_OPTIONS);
    expect(result.contract_version).toBe(CONTRACT_VERSION);
    expect(result.rides_non_groupees_ids).toEqual([RIDE_ID]);
  });

  it('lève OptimizerError(TIMEOUT) quand le service ne répond pas dans le délai', async () => {
    vi.mocked(fetch).mockImplementationOnce((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = (init as RequestInit).signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    const promise = solve(validRequest, { baseUrl: 'http://optimizer.local', timeoutMs: 10 });
    await expect(promise).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
  });

  it('lève OptimizerError(UNAVAILABLE) quand le service retourne un statut non-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Service indisponible', { status: 503 }));

    const promise = solve(validRequest, BASE_OPTIONS);
    await expect(promise).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });

  it('lève OptimizerError(CONTRACT_MISMATCH) quand la réponse a un contract_version invalide', async () => {
    const driftedResponse = { ...validResponse, contract_version: '2' };
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(driftedResponse), { status: 200 }),
    );

    const promise = solve(validRequest, BASE_OPTIONS);
    await expect(promise).rejects.toMatchObject({
      code: 'CONTRACT_MISMATCH',
    });
  });

  it("les messages d'erreur ne contiennent pas de code HTTP numérique brut", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Erreur', { status: 503 }));

    try {
      await solve(validRequest, BASE_OPTIONS);
      expect.fail('Doit lever une erreur');
    } catch (err) {
      expect(err).toBeInstanceOf(OptimizerError);
      const optimizerErr = err as OptimizerError;
      // Le message ne doit pas contenir le code HTTP brut (CLAUDE.md §13)
      expect(optimizerErr.message).not.toMatch(/\b503\b/);
      expect(optimizerErr.message).not.toMatch(/\b500\b/);
    }
  });

  it('lève OptimizerError(VALIDATION) si le payload de requête est invalide', async () => {
    // Simule un appel avec un payload incorrect (ex. : contract_version absente).
    const badRequest = { ...validRequest, contract_version: 'wrong' } as unknown as SolveRequest;
    const promise = solve(badRequest, BASE_OPTIONS);
    await expect(promise).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('ne contient pas import server-only (vérification structurelle)', () => {
    // Ce test documente l'exigence — le fichier est importé directement dans Vitest (node env).
    // Si client.ts contenait 'import server-only', le test échouerait à l'import même.
    expect(solve).toBeInstanceOf(Function);
    expect(OptimizerError).toBeInstanceOf(Function);
  });
});
