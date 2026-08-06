import { describe, it, expect } from 'vitest';
import { driverColor } from './driver-map-link';
import { GROUP_COLORS } from '../optimisation/_lib/group-colors';

describe('driverColor — couleur de repère stable par chauffeur', () => {
  it('renvoie toujours la même couleur pour un même chauffeur', () => {
    const a = driverColor('driver-abc');
    const b = driverColor('driver-abc');
    expect(a).toEqual(b);
  });

  it('est indépendante des autres chauffeurs présents (hachage, pas rang)', () => {
    // La couleur d'un chauffeur ne doit pas dépendre de l'ordre ni de la
    // présence des autres : deux appels isolés donnent le même résultat.
    const solo = driverColor('driver-xyz');
    const withOthers = ['driver-1', 'driver-2', 'driver-xyz', 'driver-3'].map(driverColor);
    expect(withOthers[2]).toEqual(solo);
  });

  it('appartient toujours à la palette partagée', () => {
    for (const id of ['a', 'bb', 'ccc', '', 'chauffeur-974', '00000000-0000-0000']) {
      expect(GROUP_COLORS).toContainEqual(driverColor(id));
    }
  });

  it('expose une classe pastille, un hex et un libellé accessible', () => {
    const c = driverColor('driver-1');
    expect(c.dot).toMatch(/^bg-/);
    expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.label.length).toBeGreaterThan(0);
  });
});
