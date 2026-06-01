import {
  CONTRACT_VERSION,
  type Groupement,
  type SolveRequest,
  type SolveResponse,
} from '@tap/optimizer-client';

/**
 * Mock du solveur — utilisé quand OPTIMIZER_USE_MOCK=true.
 * Produit une réponse conforme au contrat zod SolveResponseSchema sans appel
 * réseau au service Python.
 *
 * Objectif (ADR-008 révision 2026-06-01) : débloquer la validation
 * fonctionnelle Wave 3 (cockpit, walkthrough, E2E) sans dépendre de
 * l'hébergement Vercel Python qui n'a pas pu être stabilisé après cinq
 * tentatives de fix (PR #196..#199). Le code Python reste dans le repo,
 * prêt à être réactivé quand l'hébergement sera tranché.
 *
 * Règles de regroupement (déterministes, simples) :
 * - Si moins de 2 courses ou aucun véhicule : pas de groupement, toutes les
 *   courses retournées dans `rides_non_groupees_ids`.
 * - Sinon : groupe les courses 2 par 2 selon leur ordre dans le payload, sur
 *   le premier véhicule compatible (mapping transport_mode → vehicle.type).
 *   La dernière course orpheline (si nombre impair) va dans
 *   `rides_non_groupees_ids`.
 * - `motif` : phrase courte cohérente avec D-19 (libellé « estimé »).
 * - `gain_km_a_vide` par groupement : 4.2 km (déterministe).
 * - `km_a_vide_estimes` global : 12.5 km (valeur plausible fixe).
 *
 * Le mock ne lit AUCUNE donnée patient : il reçoit déjà un payload
 * dé-identifié depuis le Route Handler (D-08).
 */
export function mockSolve(payload: SolveRequest): SolveResponse {
  const rides = payload.rides;
  const vehicles = payload.vehicles;

  if (rides.length < 2 || vehicles.length < 1) {
    return {
      contract_version: CONTRACT_VERSION,
      groupements: [],
      rides_non_groupees_ids: rides.map((r) => r.id),
      rides_exclues_ids: [],
      km_a_vide_estimes: 0,
    };
  }

  // Appariement transport_mode → type véhicule (basique mais cohérent avec
  // l'esprit de isCompatible du domaine).
  const compatibilityMap: Record<string, string[]> = {
    taxi_conventionne: ['taxi'],
    vsl: ['vsl', 'taxi'],
    tpmr: ['tpmr'],
    ambulance: ['ambulance'],
  };

  const groupements: Groupement[] = [];
  const ridesNonGroupees: string[] = [];

  let vehicleIdx = 0;
  for (let i = 0; i < rides.length; i += 2) {
    const r1 = rides[i];
    if (!r1) continue; // garde-fou TS (`noUncheckedIndexedAccess`)
    const r2 = rides[i + 1];

    if (!r2) {
      ridesNonGroupees.push(r1.id);
      continue;
    }

    const compat1 = compatibilityMap[r1.transport_mode] ?? [];
    const compat2 = compatibilityMap[r2.transport_mode] ?? [];
    const fallback = vehicles[vehicleIdx % vehicles.length];
    if (!fallback) continue; // garde-fou TS (vehicles.length >= 1 déjà vérifié)
    const vehicle =
      vehicles.find((v) => compat1.includes(v.type) && compat2.includes(v.type)) ?? fallback;

    groupements.push({
      vehicle_id: vehicle.id,
      ride_ids: [r1.id, r2.id],
      order: [r1.id, r2.id],
      motif: 'Courses proches dans la même zone, fenêtres horaires compatibles',
      gain_km_a_vide: 4.2,
    });
    vehicleIdx += 1;
  }

  return {
    contract_version: CONTRACT_VERSION,
    groupements,
    rides_non_groupees_ids: ridesNonGroupees,
    rides_exclues_ids: [],
    km_a_vide_estimes: 12.5,
  };
}
