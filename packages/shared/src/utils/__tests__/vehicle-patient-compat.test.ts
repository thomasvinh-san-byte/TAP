import { describe, it, expect } from 'vitest';
import { checkVehiclePatientCompatibility, type VehicleEquipment } from '../vehicle-patient-compat';

const bareVehicle: VehicleEquipment = {
  type: 'taxi_conventionne',
  places_tpmr: 0,
  equipement_oxygene: false,
  equipement_brancard: false,
};

describe('checkVehiclePatientCompatibility', () => {
  it('patient sans contrainte → toujours compatible', () => {
    expect(checkVehiclePatientCompatibility(bareVehicle, [])).toEqual({
      compatible: true,
      unmet: [],
    });
  });

  it('patient oxygène + véhicule sans oxygène → incompatible avec raison', () => {
    const res = checkVehiclePatientCompatibility(bareVehicle, [{ type: 'medical_oxygene' }]);
    expect(res).toEqual({ compatible: false, unmet: ['medical_oxygene'] });
  });

  it('patient oxygène + véhicule avec oxygène → compatible', () => {
    const res = checkVehiclePatientCompatibility({ ...bareVehicle, equipement_oxygene: true }, [
      { type: 'medical_oxygene' },
    ]);
    expect(res.compatible).toBe(true);
  });

  it('fauteuil exige places_tpmr > 0', () => {
    expect(
      checkVehiclePatientCompatibility(bareVehicle, [{ type: 'medical_fauteuil' }]).compatible,
    ).toBe(false);
    expect(
      checkVehiclePatientCompatibility({ ...bareVehicle, places_tpmr: 1 }, [
        { type: 'medical_fauteuil' },
      ]).compatible,
    ).toBe(true);
  });

  it('brancard : ambulance équipée d’office', () => {
    expect(
      checkVehiclePatientCompatibility({ ...bareVehicle, type: 'ambulance' }, [
        { type: 'medical_brancard' },
      ]).compatible,
    ).toBe(true);
    expect(
      checkVehiclePatientCompatibility(bareVehicle, [{ type: 'medical_brancard' }]).compatible,
    ).toBe(false);
  });

  it('ignore les contraintes non matérielles (horaire, accompagnement, autre)', () => {
    const res = checkVehiclePatientCompatibility(bareVehicle, [
      { type: 'horaire_matin' },
      { type: 'accompagnement_obligatoire' },
      { type: 'autre' },
    ]);
    expect(res).toEqual({ compatible: true, unmet: [] });
  });

  it('cumule plusieurs contraintes non satisfaites, sans doublon', () => {
    const res = checkVehiclePatientCompatibility(bareVehicle, [
      { type: 'medical_oxygene' },
      { type: 'medical_oxygene' },
      { type: 'vehicule_tpmr' },
    ]);
    expect(res.compatible).toBe(false);
    expect(res.unmet.sort()).toEqual(['medical_oxygene', 'vehicule_tpmr']);
  });
});
