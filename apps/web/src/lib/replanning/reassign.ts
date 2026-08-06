/**
 * Proposition de réaffectation de courses (replanification dynamique, DEC-160).
 *
 * Cœur métier PUR (testable Vitest) : pour chaque course restante d'un chauffeur
 * en incident, propose le meilleur chauffeur de remplacement, scoré par
 * PROXIMITÉ (Haversine V1, PAS de géoloc temps réel HDS) + CHARGE (anti-surcharge).
 *
 * Compatibilité réutilisée à l'identique depuis `@tap/shared` (isCompatible,
 * DEC-038) : on mappe le mode de transport vers le type de véhicule requis puis
 * on vérifie les permis du candidat. Aucune divergence de règle métier.
 *
 * Point de référence d'un candidat (V1, sans position live) : le pickup de sa
 * course la plus proche dans le TEMPS de la course à réaffecter ; à défaut le
 * dépôt de l'organisation s'il est connu ; à défaut distance inconnue (le score
 * retombe sur la charge seule). La précision montera avec la géoloc HDS.
 */

import { isCompatible } from '@tap/shared';
import { haversineKm } from '@/lib/optimizer/haversine';
import { MODE_TO_VEHICLE_TYPE, type VehicleDbType } from '@/lib/optimizer/vehicle-type';

/**
 * Mode de transport d'une course. Mêmes valeurs que `vehicles.type` en base
 * (le schéma emploie le vocabulaire des modes) → alias de `VehicleDbType`.
 * La correspondance mode → type requis vit dans `MODE_TO_VEHICLE_TYPE` (source
 * unique, cf. `lib/optimizer/vehicle-type`).
 */
export type ReassignTransportMode = VehicleDbType;

/** Chaque course déjà affectée au candidat = +5 km équivalents (anti-surcharge). */
const LOAD_PENALTY_KM = 5;
/** Distance par défaut quand aucun point de référence n'est connu (km). */
const NO_REFERENCE_DISTANCE_KM = 50;

export interface RideToReassign {
  id: string;
  transport_mode: ReassignTransportMode;
  pickup_lat: number | null;
  pickup_lng: number | null;
  scheduled_at: string;
}

export interface CandidateRidePoint {
  scheduled_at: string;
  lat: number;
  lng: number;
}

export interface ReassignCandidate {
  driverId: string;
  driverLabel: string;
  typePermis: string[];
  /** Nombre de courses futures déjà affectées au candidat. */
  load: number;
  /** Pickups connus des courses du candidat (points de référence temporels). */
  refPoints: CandidateRidePoint[];
}

export interface ScoredCandidate {
  driverId: string;
  driverLabel: string;
  /** Distance estimée au pickup de la course (km) ; null si indéterminable. */
  distanceKm: number | null;
  load: number;
  /** Score (km équivalents) — plus bas = meilleur. */
  score: number;
}

export interface RideProposal {
  rideId: string;
  /** Candidats compatibles, triés du meilleur au moins bon. */
  candidates: ScoredCandidate[];
  /** Meilleur candidat, ou null si aucun candidat compatible. */
  best: ScoredCandidate | null;
  /** false = aucune réaffectation possible (CdG l.373 débordement). */
  reassignable: boolean;
}

export interface Depot {
  lat: number;
  lng: number;
}

function hasCoords(lat: number | null, lng: number | null): boolean {
  return typeof lat === 'number' && typeof lng === 'number';
}

/**
 * Point de référence d'un candidat pour une course donnée : pickup de sa course
 * la plus proche dans le temps. Renvoie null si le candidat n'a aucune course.
 */
function nearestInTimeRef(
  candidate: ReassignCandidate,
  rideScheduledAt: string,
): CandidateRidePoint | null {
  if (candidate.refPoints.length === 0) return null;
  const target = new Date(rideScheduledAt).getTime();
  let best: CandidateRidePoint | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const p of candidate.refPoints) {
    const delta = Math.abs(new Date(p.scheduled_at).getTime() - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = p;
    }
  }
  return best;
}

function estimateDistanceKm(
  ride: RideToReassign,
  candidate: ReassignCandidate,
  depot: Depot | null,
): number | null {
  if (!hasCoords(ride.pickup_lat, ride.pickup_lng)) return null;
  const ref = nearestInTimeRef(candidate, ride.scheduled_at);
  if (ref) return haversineKm(ride.pickup_lat!, ride.pickup_lng!, ref.lat, ref.lng);
  if (depot) return haversineKm(ride.pickup_lat!, ride.pickup_lng!, depot.lat, depot.lng);
  return null;
}

function scoreCandidate(
  ride: RideToReassign,
  candidate: ReassignCandidate,
  depot: Depot | null,
): ScoredCandidate {
  const distanceKm = estimateDistanceKm(ride, candidate, depot);
  const distanceComponent = distanceKm ?? NO_REFERENCE_DISTANCE_KM;
  const score = distanceComponent + candidate.load * LOAD_PENALTY_KM;
  return {
    driverId: candidate.driverId,
    driverLabel: candidate.driverLabel,
    distanceKm,
    load: candidate.load,
    score,
  };
}

function isCandidateCompatible(ride: RideToReassign, candidate: ReassignCandidate): boolean {
  return isCompatible({
    driver: { type_permis: candidate.typePermis },
    vehicle: { type: MODE_TO_VEHICLE_TYPE[ride.transport_mode] },
  });
}

/**
 * Calcule une proposition de réaffectation par course.
 *
 * @param rides      courses restantes du chauffeur en incident (déjà filtrées :
 *                   statut réaffectable, futures — l'appelant exclut en_cours/terminee).
 * @param candidates chauffeurs de remplacement (actifs, sans incident ouvert).
 * @param depot      dépôt de l'org (optionnel — sinon NO_REFERENCE).
 */
export function proposeReassignments(
  rides: ReadonlyArray<RideToReassign>,
  candidates: ReadonlyArray<ReassignCandidate>,
  depot: Depot | null = null,
): RideProposal[] {
  return rides.map((ride) => {
    const compatible = candidates.filter((c) => isCandidateCompatible(ride, c));
    const scored = compatible
      .map((c) => scoreCandidate(ride, c, depot))
      .sort((a, b) => a.score - b.score);
    return {
      rideId: ride.id,
      candidates: scored,
      best: scored[0] ?? null,
      reassignable: scored.length > 0,
    };
  });
}
