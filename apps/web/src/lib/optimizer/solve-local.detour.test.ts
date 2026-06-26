/**
 * Phase 11.01 (T5, DEC-169) — conformité du détour réglementaire sur la
 * mutualisation (décret n°2025-202 du 28/02/2025).
 *
 * Teste la fonction PURE `checkRegulatoryDetour` (logique réglementaire :
 * ≤ 10 km/personne dès la 2ᵉ, ≤ 30 km total, 1ᵉʳ patient exempt) sur des
 * séquences de passage entrelacées, + une régression au niveau du solveur
 * (un groupement conforme reste proposé). Distances Haversine (approximation V1).
 */

import { describe, it, expect } from 'vitest';
import type { RideNode, SolveRequest } from '@tap/optimizer-client';
import {
  checkRegulatoryDetour,
  solveLocal,
  type DetourStop,
  DETOUR_MAX_PAR_PERSONNE_KM,
} from './solve-local';

const UUID = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;

function node(id: string, pickup: [number, number], dropoff: [number, number]): RideNode {
  return {
    id,
    pickup,
    dropoff,
    scheduled_at: '2026-05-22T04:00:00Z',
    urgency: 'programmee',
    transport_mode: 'taxi_conventionne',
  };
}

const CF = 1; // facteur de correction neutre pour des assertions lisibles.

describe('checkRegulatoryDetour — décret 2025-202', () => {
  it('route séquentielle (pickup→dropoff par patient) = détour nul → conforme', () => {
    const a = node(UUID(1), [0, 0], [0, 0.05]);
    const b = node(UUID(2), [0, 0.1], [0, 0.15]);
    const stops: DetourStop[] = [
      { rideId: a.id, kind: 'pickup' },
      { rideId: a.id, kind: 'dropoff' },
      { rideId: b.id, kind: 'pickup' },
      { rideId: b.id, kind: 'dropoff' },
    ];
    const res = checkRegulatoryDetour([a, b], stops, CF);
    expect(res.compliant).toBe(true);
    expect(res.totalDetourKm).toBe(0);
  });

  it('2ᵉ patient avec détour > 10 km → non conforme (limite individuelle)', () => {
    const a = node(UUID(1), [0, 0], [0.1, 0.025]); // dropoff loin
    const b = node(UUID(2), [0, 0], [0, 0.05]); // direct ~5,5 km
    // Entrelacé : A pris en charge 1ᵉʳ (exempt), B passe par le dropoff de A.
    const stops: DetourStop[] = [
      { rideId: a.id, kind: 'pickup' },
      { rideId: b.id, kind: 'pickup' },
      { rideId: a.id, kind: 'dropoff' },
      { rideId: b.id, kind: 'dropoff' },
    ];
    const res = checkRegulatoryDetour([a, b], stops, CF);
    expect(res.compliant).toBe(false);
    expect(res.perRideDetourKm[b.id]!).toBeGreaterThan(DETOUR_MAX_PAR_PERSONNE_KM);
  });

  it('1ᵉʳ patient exempt de la limite individuelle (référence)', () => {
    const a = node(UUID(1), [0, 0], [0, 0.001]); // direct ~0,1 km
    const b = node(UUID(2), [0.1, 0], [0.1, 0]); // loin
    // A pris en charge 1ᵉʳ MAIS sa route passe par les stops de B (gros détour) ;
    // B (2ᵉ) a pickup→dropoff consécutifs (détour nul).
    const stops: DetourStop[] = [
      { rideId: a.id, kind: 'pickup' },
      { rideId: b.id, kind: 'pickup' },
      { rideId: b.id, kind: 'dropoff' },
      { rideId: a.id, kind: 'dropoff' },
    ];
    const res = checkRegulatoryDetour([a, b], stops, CF);
    expect(res.perRideDetourKm[a.id]!).toBeGreaterThan(DETOUR_MAX_PAR_PERSONNE_KM);
    expect(res.compliant).toBe(true); // A exempt, B conforme
  });

  it('détour cumulé > 30 km → non conforme (limite totale, individuels OK)', () => {
    const ref = node(UUID(1), [0, 0], [0, 0.04]);
    const victims = [2, 3, 4, 5].map((n) => node(UUID(n), [0, 0], [0, 0.001]));
    const rides = [ref, ...victims];
    // Tous les pickups puis tous les dropoffs : chaque victime traverse le grand
    // saut vers/depuis le dropoff lointain de la référence → ~8,7 km chacune.
    const stops: DetourStop[] = [
      { rideId: ref.id, kind: 'pickup' },
      ...victims.map((v): DetourStop => ({ rideId: v.id, kind: 'pickup' })),
      { rideId: ref.id, kind: 'dropoff' },
      ...victims.map((v): DetourStop => ({ rideId: v.id, kind: 'dropoff' })),
    ];
    const res = checkRegulatoryDetour(rides, stops, CF);
    expect(res.totalDetourKm).toBeGreaterThan(30);
    // chaque détour individuel reste sous la limite des 10 km
    for (const v of victims) expect(res.perRideDetourKm[v.id]!).toBeLessThanOrEqual(10);
    expect(res.compliant).toBe(false);
  });
});

describe('solveLocal — régression : un groupement conforme reste proposé', () => {
  it('2 courses proches (route séquentielle, détour nul) → 1 groupement', () => {
    const req: SolveRequest = {
      contract_version: '1',
      date: '2026-05-22',
      rides: [
        node(UUID(1), [-21.35, 55.47], [-21.37, 55.49]),
        node(UUID(2), [-21.355, 55.472], [-21.372, 55.491]),
      ],
      vehicles: [{ id: UUID(0x101), type: 'taxi', places_assises: 4, places_tpmr: 0 }],
      depot: [-20.8825, 55.4513],
      correction_factor: 1.3,
      avg_speed_kmh: 50,
      time_limit_seconds: 3,
    };
    const res = solveLocal(req);
    expect(res.groupements).toHaveLength(1);
    expect(res.groupements[0]!.ride_ids).toHaveLength(2);
  });
});
