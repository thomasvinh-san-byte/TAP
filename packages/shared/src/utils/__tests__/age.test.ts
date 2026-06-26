import { describe, it, expect } from 'vitest';
import { ageInYears, isMinor } from '../age';

// `now` figé pour des assertions déterministes.
const NOW = new Date('2026-06-26T12:00:00Z');

describe('ageInYears', () => {
  it('calcule l’âge révolu (anniversaire passé)', () => {
    expect(ageInYears('2000-01-01', NOW)).toBe(26);
  });

  it('retire 1 an si l’anniversaire n’est pas encore passé', () => {
    expect(ageInYears('2000-12-31', NOW)).toBe(25);
  });

  it('gère le jour anniversaire exact (révolu le jour même)', () => {
    expect(ageInYears('2008-06-26', NOW)).toBe(18);
  });

  it('renvoie null pour un format invalide', () => {
    expect(ageInYears('26/06/2008', NOW)).toBeNull();
  });
});

describe('isMinor', () => {
  it('mineur strict (< 18 ans)', () => {
    expect(isMinor('2010-06-26', NOW)).toBe(true);
  });

  it('majeur le jour de ses 18 ans', () => {
    expect(isMinor('2008-06-26', NOW)).toBe(false);
  });

  it('mineur la veille de ses 18 ans', () => {
    expect(isMinor('2008-06-27', NOW)).toBe(true);
  });

  it('format invalide → non mineur (fail-safe, pas d’avertissement erroné)', () => {
    expect(isMinor('invalide', NOW)).toBe(false);
  });
});
