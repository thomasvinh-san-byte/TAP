// =============================================================================
// Tests Vitest — parseFreeformDate (Phase 2, Plan 1, Wave 0)
// =============================================================================
// TZ : ces tests REQUIÈRENT TZ=Indian/Reunion (UTC+4) au runtime.
// La config packages/shared/vitest.config.ts injecte cette variable.
// Si elle n'est pas active (`process.env.TZ !== 'Indian/Reunion'`), les
// assertions sur les ISO UTC seraient fausses → on skip avec message clair.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { parseFreeformDate } from '../parse-freeform-date';

const TZ_OK = process.env.TZ === 'Indian/Reunion';
const describeTz = TZ_OK ? describe : describe.skip;

// Référence : 2026-05-07 08:00:00 Indian/Reunion (= 04:00:00 UTC).
const ref = new Date('2026-05-07T08:00:00+04:00');

describeTz('parseFreeformDate (TZ=Indian/Reunion)', () => {
  it('1. accepte « 15/05 14h30 » → 2026-05-15T10:30:00.000Z', () => {
    const r = parseFreeformDate('15/05 14h30', ref);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-05-15T10:30:00.000Z');
  });

  it('2. accepte « demain 8h » → J+1 08:00 Réunion = 04:00 UTC', () => {
    const r = parseFreeformDate('demain 8h', ref);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.iso).toBe('2026-05-08T04:00:00.000Z');
  });

  it('3. accepte « lundi 9h » → prochain lundi 09:00 (forwardDate)', () => {
    const r = parseFreeformDate('lundi 9h', ref);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // ref = jeudi 7 mai 2026 → prochain lundi = 11 mai
      const d = new Date(r.iso);
      // Vérifie le jour absolu (UTC) — 11 mai 09:00 Réunion = 05:00 UTC
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(4); // mai = index 4
      expect(d.getUTCDate()).toBe(11);
      expect(d.getUTCHours()).toBe(5);
      expect(d.getUTCMinutes()).toBe(0);
    }
  });

  it('4. accepte « 15 mai 14:30 » format littéraire', () => {
    const r = parseFreeformDate('15 mai 14:30', ref);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = new Date(r.iso);
      expect(d.getUTCDate()).toBe(15);
      expect(d.getUTCMonth()).toBe(4);
    }
  });

  it('5. rejette « 30/02 » (mois invalide ou date passée selon parsing)', () => {
    const r = parseFreeformDate('30/02', ref);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // chrono peut soit ne rien parser, soit produire une date proche déjà passée :
      // les deux raisons sont acceptables.
      expect(r.reason).toMatch(/Format non reconnu|passé/);
    }
  });

  it('6. rejette une date passée « 01/05/2025 »', () => {
    const r = parseFreeformDate('01/05/2025', ref);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('Date dans le passé');
  });

  it('7. rejette une saisie vide', () => {
    const r = parseFreeformDate('', ref);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('Date requise');
  });

  it('8. rejette une saisie composée uniquement d\'espaces', () => {
    const r = parseFreeformDate('   ', ref);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('Date requise');
  });
});

// Sanity check qui passe quel que soit le TZ — protège contre une dérive
// silencieuse de l'API publique du helper.
describe('parseFreeformDate (sanity, TZ-agnostique)', () => {
  it('signature et type de retour', () => {
    const r = parseFreeformDate('', new Date());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.reason).toBe('string');
  });
});
