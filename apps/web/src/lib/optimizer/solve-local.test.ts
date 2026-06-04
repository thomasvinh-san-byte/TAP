/**
 * Tests Vitest du solveur local heuristique (Phase 06.12).
 *
 * Six scénarios portés depuis `apps/web/py/solver/tests/test_solver.py` (D-05) :
 *   1. Groupement simple — fenêtres compatibles → 1 groupement.
 *   2. Fenêtres incompatibles — 8h vs 14h → 0 groupement.
 *   3. Mutualisation temporelle — Course B intercalée → 1 groupement avec order.
 *   4. Capacité respectée — 3 courses, véhicule 1 place → ≤ 2 par groupement.
 *   5. Haversine et matrice — testé dans haversine.test.ts.
 *   6. Dérivation des fenêtres horaires — tolérances par urgency.
 *
 * Le scénario 5 est traité dans haversine.test.ts (le solveur est branché
 * sur le même util — pas de duplication).
 */

import { describe, it, expect } from 'vitest';
import type { SolveRequest } from '@tap/optimizer-client';
import { solveLocal, timeWindow } from './solve-local';

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';
const UUID3 = '00000000-0000-0000-0000-000000000003';
const VEH1 = '00000000-0000-0000-0000-000000000101';

const DEPOT: [number, number] = [-20.8825, 55.4513];

function buildRequest(
  rides: SolveRequest['rides'],
  vehicles: SolveRequest['vehicles'],
): SolveRequest {
  return {
    contract_version: '1',
    date: '2026-05-22',
    rides,
    vehicles,
    depot: DEPOT,
    correction_factor: 1.3,
    avg_speed_kmh: 50,
    time_limit_seconds: 3,
  };
}

function ride(
  id: string,
  scheduledAt: string,
  pickup: [number, number] = [-21.35, 55.47],
  dropoff: [number, number] = [-21.37, 55.49],
): SolveRequest['rides'][number] {
  return {
    id,
    pickup,
    dropoff,
    scheduled_at: scheduledAt,
    urgency: 'programmee',
    transport_mode: 'taxi_conventionne',
  };
}

function vehicle(id: string, placesAssises = 4): SolveRequest['vehicles'][number] {
  return { id, type: 'taxi', places_assises: placesAssises, places_tpmr: 0 };
}

describe('solveLocal — scénario 1 : groupement simple', () => {
  it('apparie 2 courses aux horaires compatibles sur un véhicule compatible', () => {
    const req = buildRequest(
      [
        ride(UUID1, '2026-05-22T04:00:00Z', [-21.35, 55.47], [-21.37, 55.49]),
        ride(UUID2, '2026-05-22T04:15:00Z', [-21.34, 55.46], [-21.37, 55.49]),
      ],
      [vehicle(VEH1)],
    );
    const response = solveLocal(req);
    expect(response.groupements).toHaveLength(1);
    expect(new Set(response.groupements[0]!.ride_ids)).toEqual(new Set([UUID1, UUID2]));
  });
});

describe('solveLocal — scénario 2 : fenêtres incompatibles', () => {
  it('ne groupe pas 2 courses séparées de 6 heures', () => {
    const req = buildRequest(
      [ride(UUID1, '2026-05-22T04:00:00Z'), ride(UUID2, '2026-05-22T10:00:00Z')],
      [vehicle(VEH1)],
    );
    const response = solveLocal(req);
    expect(response.groupements).toHaveLength(0);
    expect(response.rides_non_groupees_ids).toHaveLength(2);
    expect(new Set(response.rides_non_groupees_ids)).toEqual(new Set([UUID1, UUID2]));
  });
});

describe('solveLocal — scénario 3 : mutualisation temporelle', () => {
  it("produit un order de 4 stops quand 2 courses s'enchaînent", () => {
    const req = buildRequest(
      [
        ride(UUID1, '2026-05-22T04:00:00Z', [-21.0, 55.3], [-21.35, 55.5]),
        ride(UUID2, '2026-05-22T04:10:00Z', [-21.1, 55.32], [-21.38, 55.52]),
      ],
      [vehicle(VEH1)],
    );
    const response = solveLocal(req);
    expect(response.groupements).toHaveLength(1);
    const g = response.groupements[0]!;
    expect(new Set(g.ride_ids)).toEqual(new Set([UUID1, UUID2]));
    expect(g.order).toHaveLength(4);
  });
});

describe('solveLocal — scénario 4 : capacité respectée', () => {
  it('conserve la traçabilité des 3 courses (groupées ou non) sur un véhicule 1 place', () => {
    const req = buildRequest(
      [
        ride(UUID1, '2026-05-22T04:00:00Z', [-21.35, 55.47], [-21.37, 55.49]),
        ride(UUID2, '2026-05-22T04:00:00Z', [-21.34, 55.46], [-21.38, 55.5]),
        ride(UUID3, '2026-05-22T04:00:00Z', [-21.33, 55.45], [-21.39, 55.51]),
      ],
      [vehicle(VEH1, 1)],
    );
    const response = solveLocal(req);
    const totalInGroupements = response.groupements.reduce((sum, g) => sum + g.ride_ids.length, 0);
    const tracked = totalInGroupements + response.rides_non_groupees_ids.length;
    expect(tracked).toBe(3);
    for (const g of response.groupements) {
      expect(g.ride_ids.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('solveLocal — scénario 6 : dérivation des fenêtres horaires', () => {
  // 8h00 UTC+4 = 4h00 UTC = "2026-05-22T04:00:00Z" → 28800 s depuis minuit UTC+4.
  const scheduledAt = '2026-05-22T04:00:00Z';
  const expectedSecs = 8 * 3600;

  it('programmee : ±1800 s', () => {
    const tw = timeWindow(scheduledAt, 'programmee');
    expect(tw.earliest).toBe(expectedSecs - 1800);
    expect(tw.latest).toBe(expectedSecs + 1800);
  });

  it('urgente : ±3600 s', () => {
    const tw = timeWindow(scheduledAt, 'urgente');
    expect(tw.earliest).toBe(expectedSecs - 3600);
    expect(tw.latest).toBe(expectedSecs + 3600);
  });

  it('immediate : ±900 s', () => {
    const tw = timeWindow(scheduledAt, 'immediate');
    expect(tw.earliest).toBe(expectedSecs - 900);
    expect(tw.latest).toBe(expectedSecs + 900);
  });
});

describe('solveLocal — garde-fous', () => {
  it('renvoie un état vide cohérent pour 0 course', () => {
    const req = buildRequest([], [vehicle(VEH1)]);
    const response = solveLocal(req);
    expect(response.groupements).toHaveLength(0);
    expect(response.rides_non_groupees_ids).toHaveLength(0);
    expect(response.km_a_vide_estimes).toBe(0);
  });

  it('renvoie toutes les courses non groupées si aucun véhicule', () => {
    const req = buildRequest([ride(UUID1, '2026-05-22T04:00:00Z')], []);
    const response = solveLocal(req);
    expect(response.groupements).toHaveLength(0);
    expect(response.rides_non_groupees_ids).toEqual([UUID1]);
  });
});
