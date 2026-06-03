import { describe, expect, it } from 'vitest';
import { GROUP_COLORS, getGroupColor } from './group-colors';

/**
 * Tests unitaires palette couleurs groupements (Phase 06.11 Wave 3 — rattrapage Wave 2).
 *
 * Pure data + pure function. Env node.
 */
describe('getGroupColor', () => {
  it('retourne la première couleur pour index 0', () => {
    const c = getGroupColor(0);
    expect(c.name).toBe('blue');
    expect(c.border).toBe('border-l-blue-500');
    expect(c.dot).toBe('bg-blue-500');
    expect(c.label).toBe('Bleu');
  });

  it('boucle modulo après la longueur de la palette (index 8 = index 0)', () => {
    expect(getGroupColor(8).name).toBe(getGroupColor(0).name);
    expect(getGroupColor(16).name).toBe(getGroupColor(0).name);
  });

  it('reste défini pour un index négatif (normalisation)', () => {
    const c = getGroupColor(-1);
    expect(c).toBeDefined();
    expect(typeof c.name).toBe('string');
  });
});

describe('GROUP_COLORS', () => {
  it('expose exactement 8 couleurs', () => {
    expect(GROUP_COLORS).toHaveLength(8);
  });

  it('chaque entrée a les 4 champs requis non vides', () => {
    for (const c of GROUP_COLORS) {
      expect(c.name).toBeTruthy();
      expect(c.border).toMatch(/^border-l-/);
      expect(c.dot).toMatch(/^bg-/);
      expect(c.label).toBeTruthy();
    }
  });
});
