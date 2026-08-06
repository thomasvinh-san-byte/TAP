import type { VehicleRow } from '@tap/optimizer-client';

/**
 * Correspondance UNIQUE « valeur base → type de véhicule solveur ».
 *
 * Le schéma stocke `vehicles.type` avec le vocabulaire des MODES de transport
 * (`taxi_conventionne`, cf. CHECK de la migration 20260512000002_vehicles),
 * alors que le contrat du solveur attend un `type` dans
 * `{ taxi, tpmr, vsl, ambulance }`. Cette table convertit l'un vers l'autre :
 * seul `taxi_conventionne` change (→ `taxi`), les autres sont identiques.
 *
 * Source de vérité unique, réutilisée par :
 *   - la réaffectation (`replanning/reassign`) : mode de COURSE → type requis ;
 *   - le chargement des véhicules pour l'optimiseur : type de VÉHICULE base →
 *     type solveur.
 * La correspondance des valeurs est la même dans les deux sens d'usage.
 */

/** Type de véhicule attendu par le solveur (`{ taxi, tpmr, vsl, ambulance }`). */
export type SolverVehicleType = VehicleRow['type'];

/**
 * Valeurs possibles de `vehicles.type` en base (vocabulaire des modes de
 * transport). Alignées sur le CHECK de la migration vehicles.
 */
export type VehicleDbType = 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';

/**
 * Correspondance des valeurs. Typée `SolverVehicleType` en sortie : le résultat
 * du mapping est réellement conforme au contrat solveur — aucun `as` nécessaire.
 * Toutes les valeurs de `VehicleDbType` sont couvertes (le `Record` l'impose).
 */
export const MODE_TO_VEHICLE_TYPE: Record<VehicleDbType, SolverVehicleType> = {
  taxi_conventionne: 'taxi',
  tpmr: 'tpmr',
  vsl: 'vsl',
  ambulance: 'ambulance',
};
