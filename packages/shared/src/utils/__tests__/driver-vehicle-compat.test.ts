/**
 * Tests Vitest — compatibilité chauffeur ↔ véhicule.
 * 100 % branch coverage (DEC-013 esprit — règle métier critique 974).
 *
 * Matrice 16 cas + 1 cas erreur (type inconnu) = 17 tests.
 *
 * Refs : PLAN-4 Task 4.1, D-11, DEC-038.
 */

import { describe, expect, it } from 'vitest';
import { isCompatible } from '../driver-vehicle-compat';

const PERMIS_SETS = {
  bOnly: ['b'],
  taxiOnly: ['taxi'],
  tpmrOnly: ['tpmr'],
  multi: ['taxi', 'tpmr', 'ambulance'],
} as const;

function call(permisSet: ReadonlyArray<string>, vehicleType: string): boolean {
  return isCompatible({
    driver: { type_permis: permisSet },
    vehicle: { type: vehicleType },
  });
}

describe('isCompatible — matrice 16 cas', () => {
  // Véhicule tpmr (exige permis tpmr)
  it('tpmr × [b] = false', () => expect(call(PERMIS_SETS.bOnly, 'tpmr')).toBe(false));
  it('tpmr × [taxi] = false', () => expect(call(PERMIS_SETS.taxiOnly, 'tpmr')).toBe(false));
  it('tpmr × [tpmr] = true', () => expect(call(PERMIS_SETS.tpmrOnly, 'tpmr')).toBe(true));
  it('tpmr × [taxi,tpmr,ambulance] = true', () =>
    expect(call(PERMIS_SETS.multi, 'tpmr')).toBe(true));

  // Véhicule vsl (permis vsl OU taxi)
  it('vsl × [b] = false', () => expect(call(PERMIS_SETS.bOnly, 'vsl')).toBe(false));
  it('vsl × [taxi] = true (taxi conventionné fait VSL)', () =>
    expect(call(PERMIS_SETS.taxiOnly, 'vsl')).toBe(true));
  it('vsl × [tpmr] = false (TPMR seul ne fait pas VSL)', () =>
    expect(call(PERMIS_SETS.tpmrOnly, 'vsl')).toBe(false));
  it('vsl × [taxi,tpmr,ambulance] = true', () => expect(call(PERMIS_SETS.multi, 'vsl')).toBe(true));

  // Véhicule taxi (exige permis taxi)
  it('taxi × [b] = false', () => expect(call(PERMIS_SETS.bOnly, 'taxi')).toBe(false));
  it('taxi × [taxi] = true', () => expect(call(PERMIS_SETS.taxiOnly, 'taxi')).toBe(true));
  it('taxi × [tpmr] = false', () => expect(call(PERMIS_SETS.tpmrOnly, 'taxi')).toBe(false));
  it('taxi × [taxi,tpmr,ambulance] = true', () =>
    expect(call(PERMIS_SETS.multi, 'taxi')).toBe(true));

  // Véhicule ambulance (exige permis ambulance)
  it('ambulance × [b] = false', () => expect(call(PERMIS_SETS.bOnly, 'ambulance')).toBe(false));
  it('ambulance × [taxi] = false', () =>
    expect(call(PERMIS_SETS.taxiOnly, 'ambulance')).toBe(false));
  it('ambulance × [tpmr] = false', () =>
    expect(call(PERMIS_SETS.tpmrOnly, 'ambulance')).toBe(false));
  it('ambulance × [taxi,tpmr,ambulance] = true', () =>
    expect(call(PERMIS_SETS.multi, 'ambulance')).toBe(true));
});

describe('isCompatible — defense in depth', () => {
  it('type véhicule inconnu (autre) = false', () => {
    expect(call(PERMIS_SETS.multi, 'autre')).toBe(false);
  });

  it('chauffeur sans permis (array vide) = false sur tous véhicules', () => {
    expect(call([], 'tpmr')).toBe(false);
    expect(call([], 'vsl')).toBe(false);
    expect(call([], 'taxi')).toBe(false);
    expect(call([], 'ambulance')).toBe(false);
  });
});
