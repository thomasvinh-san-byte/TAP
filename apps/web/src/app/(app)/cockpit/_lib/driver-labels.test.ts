import { describe, it, expect } from 'vitest';
import { buildDriverLabels } from './driver-labels';

/**
 * Verrouille la résolution du nom de chauffeur : une position portant une
 * identité de connexion (profiles.id) doit produire le nom de la fiche dont
 * `profile_id` correspond — et non être indexée par la clé primaire `drivers.id`
 * (le bug corrigé : jointure sur la mauvaise colonne).
 */
describe('buildDriverLabels — indexé par profile_id (identité de connexion)', () => {
  it('résout le nom via profile_id = valeur portée par la position', () => {
    const positionDriverId = '00000000-0000-0000-0000-000000000030'; // driver_positions.driver_id
    const driverPk = '22222222-0000-0000-0000-000000000011'; // drivers.id (clé primaire)

    const labels = buildDriverLabels([
      { profile_id: positionDriverId, nom_affichage: 'Vergoz Jean' },
      { profile_id: '00000000-0000-0000-0000-000000000031', nom_affichage: 'Maillot André' },
    ]);

    // Le panneau fait driverLabels[position.driver_id] → doit trouver le nom.
    expect(labels[positionDriverId]).toBe('Vergoz Jean');
    // Ne doit PAS être indexé par la clé primaire de la fiche.
    expect(labels[driverPk]).toBeUndefined();
    expect(Object.keys(labels)).toEqual([
      '00000000-0000-0000-0000-000000000030',
      '00000000-0000-0000-0000-000000000031',
    ]);
  });

  it('ignore une fiche sans profile_id (compte non rattaché)', () => {
    expect(buildDriverLabels([{ profile_id: null, nom_affichage: 'Sans compte' }])).toEqual({});
  });
});
