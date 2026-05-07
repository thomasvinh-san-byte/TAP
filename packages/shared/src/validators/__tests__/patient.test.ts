// =============================================================================
// Tests Vitest — patientSchema (Phase 1, Plan 1, Wave 0 partiel RED)
// =============================================================================
// État Wave 0 :
//   - Cas 1-5 : passent déjà avec le schéma actuel (packages/shared/src/
//     validators/patient.ts).
//   - Cas 6-10 : RED — Plan 2 (Wave 1) étendra le schéma avec
//     consentement_sms_at, genre, contact_urgence, normalizeNir.
// =============================================================================

import { describe, expect, it } from 'vitest';
import { patientSchema, canalContactSchema } from '../patient';

describe('patientSchema — cas existants (cas 1-5)', () => {
  const baseValide = {
    prenom: 'Patrick',
    nom: 'Hoarau',
    date_naissance: '1980-01-23',
    adresse: {
      ligne1: '12 rue Pasteur',
      code_postal: '97400',
      ville: 'Saint-Denis',
    },
    canal_contact_prefere: 'appel' as const,
    consentement_sms: false,
  };

  it('1. accepte un patient minimal valide', () => {
    const parsed = patientSchema.parse(baseValide);
    expect(parsed.nom).toBe('Hoarau');
    expect(parsed.prenom).toBe('Patrick');
  });

  it('2. refuse un prénom vide', () => {
    expect(() =>
      patientSchema.parse({ ...baseValide, prenom: '' }),
    ).toThrow();
  });

  it('3. refuse une date_naissance au mauvais format', () => {
    expect(() =>
      patientSchema.parse({ ...baseValide, date_naissance: '23/01/1980' }),
    ).toThrow();
  });

  it('4. NIR optionnel — accepté absent', () => {
    expect(() => patientSchema.parse(baseValide)).not.toThrow();
  });

  it('5. téléphone normalisé (espaces retirés)', () => {
    const parsed = patientSchema.parse({
      ...baseValide,
      telephone: '06 92 12 34 56',
    });
    expect(parsed.telephone).toBe('0692123456');
  });
});

describe('patientSchema — extensions Plan 2 (cas 6-10, RED Wave 0)', () => {
  const baseValide = {
    prenom: 'Marie',
    nom: 'Payet',
    date_naissance: '1975-06-15',
    adresse: {
      ligne1: '8 rue Léon Dierx',
      code_postal: '97400',
      ville: 'Saint-Denis',
    },
    canal_contact_prefere: 'appel' as const,
    consentement_sms: false,
  };

  it('6. consentement_sms=true SANS consentement_sms_at lève une erreur', () => {
    // Wave 1 ajoutera le superRefine qui exige consentement_sms_at
    // si consentement_sms=true (DEC-008).
    const schemaEtendu = patientSchema as unknown as typeof patientSchema & {
      _refines?: unknown;
    };
    expect(() =>
      schemaEtendu.parse({
        ...baseValide,
        consentement_sms: true,
        // consentement_sms_at volontairement absent
      }),
    ).toThrow(/[Hh]orodatage de consentement requis/);
  });

  it('7. consentement_sms=false SANS consentement_sms_at est accepté', () => {
    expect(() =>
      patientSchema.parse({
        ...baseValide,
        consentement_sms: false,
      }),
    ).not.toThrow();
  });

  it("8. genre accepte 'M', 'F', 'X' et refuse 'autre'", async () => {
    // Wave 1 : ajout d'un champ genre dans patientSchema.
    const mod = (await import('../patient')) as unknown as {
      genreSchema?: { parse: (v: string) => string };
    };
    if (!mod.genreSchema) {
      throw new Error('genreSchema non exporté (RED attendu Wave 0)');
    }
    expect(mod.genreSchema.parse('M')).toBe('M');
    expect(mod.genreSchema.parse('F')).toBe('F');
    expect(mod.genreSchema.parse('X')).toBe('X');
    expect(() => mod.genreSchema!.parse('autre')).toThrow();
  });

  it('9. contact_urgence requiert nom + téléphone réunionnais valide', async () => {
    const mod = (await import('../patient')) as unknown as {
      contactUrgenceSchema?: {
        parse: (v: { nom: string; telephone: string }) => unknown;
      };
    };
    if (!mod.contactUrgenceSchema) {
      throw new Error('contactUrgenceSchema non exporté (RED attendu Wave 0)');
    }
    expect(() =>
      mod.contactUrgenceSchema!.parse({
        nom: 'Hoarau Solange',
        telephone: '0692111222',
      }),
    ).not.toThrow();
    // Téléphone hors 974 refusé
    expect(() =>
      mod.contactUrgenceSchema!.parse({
        nom: 'Métropole',
        telephone: '0612345678',
      }),
    ).toThrow();
  });

  it("10. normalizeNir('1 80 12 34 567 823') retourne '1801234567823'", async () => {
    const mod = (await import('../patient')) as unknown as {
      normalizeNir?: (v: string) => string;
    };
    if (!mod.normalizeNir) {
      throw new Error('normalizeNir non exporté (RED attendu Wave 0)');
    }
    expect(mod.normalizeNir('1 80 12 34 567 823')).toBe('1801234567823');
    expect(mod.normalizeNir('1801234567823')).toBe('1801234567823');
  });
});

describe('canalContactSchema (sanity check)', () => {
  it('accepte sms, appel, aucun', () => {
    expect(canalContactSchema.parse('sms')).toBe('sms');
    expect(canalContactSchema.parse('appel')).toBe('appel');
    expect(canalContactSchema.parse('aucun')).toBe('aucun');
  });
});
