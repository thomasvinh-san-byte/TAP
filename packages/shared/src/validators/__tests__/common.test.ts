import { describe, expect, it } from 'vitest';
import { codePostalReunionSchema, siretSchema, telephoneReunionSchema } from '../common';

describe('telephoneReunionSchema', () => {
  it('accepte un mobile 0692', () => {
    expect(telephoneReunionSchema.parse('0692123456')).toBe('0692123456');
  });

  it('tolère les espaces', () => {
    expect(telephoneReunionSchema.parse('06 92 12 34 56')).toBe('0692123456');
  });

  it('refuse un numéro métropolitain', () => {
    expect(() => telephoneReunionSchema.parse('0612345678')).toThrow();
  });
});

describe('codePostalReunionSchema', () => {
  it('accepte 97400', () => {
    expect(codePostalReunionSchema.parse('97400')).toBe('97400');
  });

  it('refuse 75000', () => {
    expect(() => codePostalReunionSchema.parse('75000')).toThrow();
  });
});

describe('siretSchema', () => {
  it('accepte un SIRET valide', () => {
    expect(siretSchema.parse('12345678900007')).toBe('12345678900007');
  });

  it('accepte un SIRET réel Luhn-valide (Carrefour, NIC 0001, clé 4)', () => {
    // SIREN 404833048 + NIC 0001 + clé Luhn 4. La clé correcte pour ces 13
    // premiers chiffres est 4 (diagnostic sourcé INSEE / InseeFrLab/validinsee).
    expect(siretSchema.parse('40483304800014')).toBe('40483304800014');
  });

  it('refuse un SIRET trop court', () => {
    expect(() => siretSchema.parse('123')).toThrow();
  });

  it('refuse un SIRET au mauvais checksum', () => {
    expect(() => siretSchema.parse('12345678901234')).toThrow();
  });

  it('refuse un SIRET à la clé Luhn fausse (Carrefour clé 0 au lieu de 4)', () => {
    // Régression : 40483304800010 n'est PAS Luhn-valide (clé 0 erronée).
    // L'algo doit le rejeter — il ne s'agit pas d'un bug de verifyLuhn.
    expect(() => siretSchema.parse('40483304800010')).toThrow();
  });
});
