import { describe, expect, it } from 'vitest';
import { VEHICLE_BRANDS, VEHICLE_CATALOG, modelsForBrand, normalizeBrandOrModel } from './catalog';

describe('catalog véhicules', () => {
  it('expose la liste des marques connues', () => {
    expect(VEHICLE_BRANDS).toContain('Renault');
    expect(VEHICLE_BRANDS).toContain('Peugeot');
    expect(VEHICLE_BRANDS).toContain('Citroën');
  });

  it('renvoie les modèles connus pour une marque', () => {
    expect(modelsForBrand('Renault')).toContain('Master');
    expect(modelsForBrand('Renault')).toContain('Kangoo');
    expect(modelsForBrand('Peugeot')).toContain('Boxer');
  });

  it('renvoie tableau vide pour une marque inconnue (saisie libre)', () => {
    expect(modelsForBrand('Tesla')).toEqual([]);
    expect(modelsForBrand('')).toEqual([]);
  });

  it('Title Case les saisies normales', () => {
    expect(normalizeBrandOrModel('renault')).toBe('Renault');
    expect(normalizeBrandOrModel('PEUGEOT 208')).toBe('PEUGEOT 208');
    expect(normalizeBrandOrModel('peugeot 208')).toBe('Peugeot 208');
  });

  it('préserve les acronymes en majuscules', () => {
    expect(normalizeBrandOrModel('BMW')).toBe('BMW');
    expect(normalizeBrandOrModel('VW')).toBe('VW');
  });

  it('trim les espaces et tolère les chaînes vides', () => {
    expect(normalizeBrandOrModel('  renault  ')).toBe('Renault');
    expect(normalizeBrandOrModel('')).toBe('');
    expect(normalizeBrandOrModel('   ')).toBe('');
  });

  it('respecte la structure : toutes les marques ont au moins 1 modèle', () => {
    for (const brand of VEHICLE_BRANDS) {
      expect(VEHICLE_CATALOG[brand]?.length).toBeGreaterThan(0);
    }
  });
});
