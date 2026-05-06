import { describe, expect, it } from 'vitest';
import {
  codePostalReunionSchema,
  siretSchema,
  telephoneReunionSchema,
} from '../common';

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
  it('accepte un SIRET valide (Carrefour)', () => {
    expect(siretSchema.parse('40483304800010')).toBe('40483304800010');
  });

  it('refuse un SIRET trop court', () => {
    expect(() => siretSchema.parse('123')).toThrow();
  });

  it('refuse un SIRET au mauvais checksum', () => {
    expect(() => siretSchema.parse('12345678901234')).toThrow();
  });
});
