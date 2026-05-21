/**
 * Tests Vitest — algorithme INSEE clé de contrôle NIR.
 * 100 % branch coverage attendu (DEC-013 esprit — algo critique data santé).
 *
 * Stratégie : round-trip pour les cas valides (compute → assemble → verify)
 * + cas erreur structurelle (longueur, caractères, clé fausse).
 *
 * Refs : PLAN-2 Task 2.1, D-04, DEC-036.
 */

import { describe, expect, it } from 'vitest';
import { computeNirChecksum, isNirChecksumValid } from '../nir-checksum';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function buildValid(head13: string): string {
  const key = computeNirChecksum(head13 + '00');
  return head13 + pad2(key);
}

describe('computeNirChecksum', () => {
  it('renvoie une clé entre 0 et 97 pour une entrée 13 chiffres + 2 quelconques', () => {
    const key = computeNirChecksum('176052597400100');
    expect(key).toBeGreaterThanOrEqual(0);
    expect(key).toBeLessThanOrEqual(97);
  });

  it('renvoie -1 si entrée trop courte', () => {
    expect(computeNirChecksum('176052597400')).toBe(-1);
  });

  it('renvoie -1 si entrée trop longue', () => {
    expect(computeNirChecksum('17605259740010000')).toBe(-1);
  });

  it('renvoie -1 si caractères non numériques hors zone Corse', () => {
    expect(computeNirChecksum('17605ABC97400169')).toBe(-1);
  });

  it('renvoie -1 si entrée non-string', () => {
    // @ts-expect-error — test de robustesse runtime
    expect(computeNirChecksum(null)).toBe(-1);
    // @ts-expect-error — test de robustesse runtime
    expect(computeNirChecksum(undefined)).toBe(-1);
    // @ts-expect-error — test de robustesse runtime
    expect(computeNirChecksum(176052597400169)).toBe(-1);
  });

  it('accepte 2A en positions 6-7 (Corse-du-Sud)', () => {
    // 1 80 12 2A 001 001 — homme né 1980 décembre, Corse-du-Sud
    const key = computeNirChecksum('180122A00100100');
    expect(key).toBeGreaterThanOrEqual(0);
  });

  it('accepte 2B en positions 6-7 (Haute-Corse)', () => {
    const key = computeNirChecksum('180122B00100100');
    expect(key).toBeGreaterThanOrEqual(0);
  });

  it('tolère les espaces en entrée', () => {
    const k1 = computeNirChecksum('176052597400100');
    const k2 = computeNirChecksum('1 76 05 25 974 001 00');
    expect(k1).toBe(k2);
  });
});

describe('isNirChecksumValid', () => {
  it('accepte un NIR construit avec la bonne clé (Réunion 974)', () => {
    const valid = buildValid('1760525974001');
    expect(isNirChecksumValid(valid)).toBe(true);
  });

  it('accepte un NIR métropole construit avec la bonne clé', () => {
    const valid = buildValid('2850375056042');
    expect(isNirChecksumValid(valid)).toBe(true);
  });

  it('accepte un NIR Corse-du-Sud (2A) construit avec la bonne clé', () => {
    const valid = buildValid('180122A001001');
    expect(isNirChecksumValid(valid)).toBe(true);
  });

  it('accepte un NIR Haute-Corse (2B) construit avec la bonne clé', () => {
    const valid = buildValid('180122B001001');
    expect(isNirChecksumValid(valid)).toBe(true);
  });

  it('refuse une clé off-by-one', () => {
    const valid = buildValid('1760525974001');
    const wrongKey = (Number.parseInt(valid.slice(13, 15), 10) + 1) % 100;
    const broken = valid.slice(0, 13) + pad2(wrongKey);
    expect(isNirChecksumValid(broken)).toBe(false);
  });

  it('refuse 14 chiffres (trop court)', () => {
    expect(isNirChecksumValid('17605259740016')).toBe(false);
  });

  it('refuse 16 chiffres (trop long)', () => {
    expect(isNirChecksumValid('1760525974001699')).toBe(false);
  });

  it('refuse les lettres autres que 2A/2B aux positions 6-7', () => {
    expect(isNirChecksumValid('17605XY97400169')).toBe(false);
  });

  it('refuse une entrée vide', () => {
    expect(isNirChecksumValid('')).toBe(false);
  });

  it('refuse une entrée non-string', () => {
    // @ts-expect-error — test runtime
    expect(isNirChecksumValid(null)).toBe(false);
    // @ts-expect-error
    expect(isNirChecksumValid(undefined)).toBe(false);
    // @ts-expect-error
    expect(isNirChecksumValid(176052597400169)).toBe(false);
  });

  it('tolère les espaces en entrée valide', () => {
    const valid = buildValid('1760525974001');
    const spaced =
      valid.slice(0, 1) +
      ' ' +
      valid.slice(1, 3) +
      ' ' +
      valid.slice(3, 5) +
      ' ' +
      valid.slice(5, 7) +
      ' ' +
      valid.slice(7, 10) +
      ' ' +
      valid.slice(10, 13) +
      ' ' +
      valid.slice(13, 15);
    expect(isNirChecksumValid(spaced)).toBe(true);
  });

  it('refuse une clé non-numérique', () => {
    expect(isNirChecksumValid('17605259740016X')).toBe(false);
  });
});
