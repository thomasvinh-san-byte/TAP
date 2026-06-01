/**
 * Transformations pures : courses DB → payload solveur dé-identifié ; réponse solveur → proposition.
 * Aucun effet de bord, aucun appel réseau, aucun accès Supabase — testable sans mock complexe.
 */

import {
  type SolveRequest,
  type SolveResponse,
  type Groupement,
  CONTRACT_VERSION,
} from './contract';

/** Course telle que lue depuis la base par le Route Handler (Wave 3). */
export type RideRow = {
  id: string;
  scheduled_at: string;
  urgency: 'programmee' | 'urgente' | 'immediate';
  transport_mode: 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  pickup_citycode: string | null;
  dropoff_citycode: string | null;
};

/** Véhicule disponible tel que lu depuis la base. */
export type VehicleRow = {
  id: string;
  type: 'taxi' | 'tpmr' | 'vsl' | 'ambulance';
  places_assises: number;
  places_tpmr: number;
};

/** Course exclue du payload solveur avec la raison. */
export type ExcludedRide = {
  id: string;
  reason: 'no_coordinates';
};

/** Proposition d'optimisation retournée à l'appelant (Route Handler / UI). */
export type OptimizationProposal = {
  groupements: Groupement[];
  ridesNonGroupeesIds: string[];
  excludedRides: ExcludedRide[];
  /** Taux de mutualisation en pourcentage entier 0..100 (D-19). */
  tauxMutualisation: number;
  /** Km à vide estimés pour le plan proposé (D-19). */
  kmAVideEstimes: number;
};

/**
 * Options pour la construction du payload solveur.
 */
export type SolveRequestOpts = {
  date: string;
  depot: [number, number];
  correctionFactor: number;
  avgSpeedKmh: number;
  timeLimitSeconds: number;
};

/**
 * Transforme les courses DB en payload solveur dé-identifié.
 * Exclut les courses sans coordonnées (D-17).
 * Ne transmet jamais de champ patient/nom/nir (D-08) — mapping champ par champ explicite.
 *
 * Si toutes les courses sont exclues, payload.rides peut être vide ;
 * le Route Handler décidera alors de ne pas appeler le solveur (schéma exige min 1).
 */
export function ridesToSolveRequest(
  rides: RideRow[],
  vehicles: VehicleRow[],
  opts: SolveRequestOpts,
): {
  payload: Omit<SolveRequest, 'rides'> & { rides: SolveRequest['rides'] };
  excluded: ExcludedRide[];
} {
  const excluded: ExcludedRide[] = [];
  const validRides: SolveRequest['rides'] = [];

  for (const ride of rides) {
    if (
      ride.pickup_lat === null ||
      ride.pickup_lng === null ||
      ride.dropoff_lat === null ||
      ride.dropoff_lng === null
    ) {
      excluded.push({ id: ride.id, reason: 'no_coordinates' });
      continue;
    }

    // Mapping explicite champ par champ — jamais de spread de la ligne DB (D-08).
    validRides.push({
      id: ride.id,
      pickup: [ride.pickup_lat, ride.pickup_lng],
      dropoff: [ride.dropoff_lat, ride.dropoff_lng],
      scheduled_at: ride.scheduled_at,
      urgency: ride.urgency,
      transport_mode: ride.transport_mode,
    });
  }

  const vehicleNodes: SolveRequest['vehicles'] = vehicles.map((v) => ({
    id: v.id,
    type: v.type,
    places_assises: v.places_assises,
    places_tpmr: v.places_tpmr,
  }));

  const payload: SolveRequest = {
    contract_version: CONTRACT_VERSION,
    date: opts.date,
    rides: validRides,
    vehicles: vehicleNodes,
    depot: opts.depot,
    correction_factor: opts.correctionFactor,
    avg_speed_kmh: opts.avgSpeedKmh,
    time_limit_seconds: opts.timeLimitSeconds,
  };

  return { payload, excluded };
}

/**
 * Transforme la SolveResponse en OptimizationProposal affichable.
 * Calcule le taux de mutualisation et intègre les courses exclues côté client (D-17, D-19).
 *
 * @param response - Réponse validée du solveur
 * @param totalRides - Nombre total de courses soumises (avant exclusion coords)
 * @param excluded - Courses exclues avant envoi au solveur
 */
export function solveResponseToProposal(
  response: SolveResponse,
  totalRides: number,
  excluded: ExcludedRide[],
): OptimizationProposal {
  const ridesInGroupements = response.groupements.reduce((sum, g) => sum + g.ride_ids.length, 0);

  const tauxMutualisation =
    totalRides === 0 ? 0 : Math.round((ridesInGroupements / totalRides) * 100);

  return {
    groupements: response.groupements,
    ridesNonGroupeesIds: response.rides_non_groupees_ids,
    excludedRides: excluded,
    tauxMutualisation,
    kmAVideEstimes: response.km_a_vide_estimes,
  };
}
