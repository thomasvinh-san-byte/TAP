/**
 * Compatibilité véhicule ↔ patient (VEHICULE-01, §5.7).
 *
 * Util PUR sans dépendance, sur le modèle de `driver-vehicle-compat.ts`.
 * Croise les équipements d'un véhicule avec les contraintes matérielles d'un
 * patient (enum public.patient_constraint_type). Un patient nécessitant un
 * équipement n'est compatible qu'avec un véhicule qui le porte.
 *
 * Périmètre : SEULES les contraintes de type « équipement » sont vérifiées.
 * Les contraintes non matérielles (horaire_matin, horaire_apres_midi,
 * accompagnement_obligatoire, autre) sont ignorées ici — hors compatibilité
 * matérielle.
 *
 * « Exposer, pas imposer » : cette fonction informe (compatible + raisons) ;
 * elle ne bloque rien. L'intégration dure au solveur est un lot ultérieur.
 */

/** Contraintes patient de type équipement vérifiées par la compatibilité. */
export const EQUIPMENT_CONSTRAINT_TYPES = [
  'medical_oxygene',
  'medical_brancard',
  'medical_fauteuil',
  'vehicule_tpmr',
] as const;
export type EquipmentConstraintType = (typeof EQUIPMENT_CONSTRAINT_TYPES)[number];

/** Libellés des contraintes non satisfaites (affichage régulateur). */
export const UNMET_CONSTRAINT_LABELS: Record<EquipmentConstraintType, string> = {
  medical_oxygene: 'Oxygène manquant',
  medical_brancard: 'Accès brancard manquant',
  medical_fauteuil: 'Accès fauteuil manquant',
  vehicule_tpmr: 'Véhicule TPMR requis',
};

export interface VehicleEquipment {
  /** Type véhicule — 'ambulance' implique l'accès brancard d'office. */
  type?: string | null;
  places_tpmr?: number | null;
  equipement_oxygene?: boolean | null;
  equipement_brancard?: boolean | null;
}

export interface PatientConstraintLike {
  type: string;
}

export interface VehiclePatientCompatResult {
  compatible: boolean;
  /** Types de contrainte non satisfaits (clé pour libellé via UNMET_CONSTRAINT_LABELS). */
  unmet: EquipmentConstraintType[];
}

function isEquipmentConstraint(type: string): type is EquipmentConstraintType {
  return (EQUIPMENT_CONSTRAINT_TYPES as readonly string[]).includes(type);
}

/** Le véhicule satisfait-il une contrainte d'équipement donnée ? */
function vehicleSatisfies(vehicle: VehicleEquipment, constraint: EquipmentConstraintType): boolean {
  switch (constraint) {
    case 'medical_oxygene':
      return vehicle.equipement_oxygene === true;
    case 'medical_brancard':
      return vehicle.equipement_brancard === true || vehicle.type === 'ambulance';
    case 'medical_fauteuil':
    case 'vehicule_tpmr':
      return (vehicle.places_tpmr ?? 0) > 0;
  }
}

/**
 * Compatibilité matérielle d'un véhicule avec les contraintes d'un patient.
 * Patient sans contrainte d'équipement → toujours compatible.
 */
export function checkVehiclePatientCompatibility(
  vehicle: VehicleEquipment,
  constraints: ReadonlyArray<PatientConstraintLike>,
): VehiclePatientCompatResult {
  const unmet: EquipmentConstraintType[] = [];
  for (const c of constraints) {
    if (!isEquipmentConstraint(c.type)) continue;
    if (!vehicleSatisfies(vehicle, c.type) && !unmet.includes(c.type)) {
      unmet.push(c.type);
    }
  }
  return { compatible: unmet.length === 0, unmet };
}
