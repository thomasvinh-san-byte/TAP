/**
 * Compatibilité chauffeur ↔ véhicule (règles métier 974).
 *
 * Util pur sans dépendance. Réutilisable côté UI (filtre modal assignation)
 * et côté Server Action (validation finale, Phase 06).
 *
 * Matrice :
 *   - véhicule tpmr      → exige permis tpmr (formation spécifique 974)
 *   - véhicule vsl       → permis vsl OU taxi (taxi conventionné fait VSL)
 *   - véhicule taxi      → exige permis taxi
 *   - véhicule ambulance → exige permis ambulance
 *   - type inconnu       → refus par défaut (defense in depth)
 *
 * Refs : PLAN-4 Task 4.1, D-11, DEC-038.
 */

// Renommés CompatVehicleType / CompatPermisType pour ne pas collisionner
// avec les types Zod existants exportés via validators/vehicle.
export type CompatVehicleType = 'tpmr' | 'vsl' | 'taxi' | 'ambulance';
export type CompatPermisType = 'tpmr' | 'taxi' | 'vsl' | 'ambulance' | 'b';

export interface CompatibilityInput {
  driver: { type_permis: ReadonlyArray<string> };
  vehicle: { type: string };
}

export function isCompatible(input: CompatibilityInput): boolean {
  const { driver, vehicle } = input;
  const permis = new Set(driver.type_permis);
  switch (vehicle.type) {
    case 'tpmr':
      return permis.has('tpmr');
    case 'vsl':
      return permis.has('vsl') || permis.has('taxi');
    case 'taxi':
      return permis.has('taxi');
    case 'ambulance':
      return permis.has('ambulance');
    default:
      // Type véhicule inconnu (ex : 'autre') → refus par défaut.
      // T-04.5-22 defense in depth : préfère refuser qu'autoriser sans contrat.
      return false;
  }
}
