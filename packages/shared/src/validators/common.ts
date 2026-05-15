import { z } from 'zod';
import {
  VILLES_974,
  cpDominantVille,
  type Ville974,
} from '../constants/villes-974';
import { isNirChecksumValid } from '../utils/nir-checksum';

export { VILLES_974, cpDominantVille, type Ville974 };

/**
 * Téléphone réunionnais accepté :
 * - fixe : 0262 / 0263 + 6 chiffres
 * - mobile : 0692 / 0693 + 6 chiffres
 * - format international : +262 / +263 etc. accepté
 *
 * Espaces et points sont tolérés en entrée mais retirés au parse.
 */
export const telephoneReunionSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .refine(
    (value) =>
      /^0(?:262|263|692|693)[0-9]{6}$/.test(value) ||
      /^\+262(?:62|63|92|93)[0-9]{6}$/.test(value),
    {
      message:
        'Le numéro doit commencer par 0262, 0263, 0692 ou 0693 (10 chiffres).',
    },
  );

/**
 * Code postal Réunion : 974xx.
 */
export const codePostalReunionSchema = z
  .string()
  .trim()
  .regex(/^974[0-9]{2}$/, {
    message: 'Code postal Réunion : 974 + 2 chiffres (ex : 97400).',
  });

/**
 * SIRET : 14 chiffres + checksum Luhn.
 */
export const siretSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{14}$/, { message: 'SIRET : 14 chiffres requis.' })
  .refine(verifyLuhn, { message: 'SIRET invalide (échec contrôle Luhn).' });

function verifyLuhn(siret: string): boolean {
  let sum = 0;
  for (let i = 0; i < siret.length; i++) {
    const char = siret.charAt(siret.length - 1 - i);
    let digit = Number.parseInt(char, 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * NIR (numéro de sécurité sociale français, 13 chiffres + clé sur 2).
 * La validation complète de la clé se fait côté serveur uniquement,
 * pour éviter d'exposer la logique côté client.
 */
/**
 * NIR strict avec clé de contrôle INSEE.
 *
 * - 15 chiffres au total (sexe + année + mois + département + commune + ordre + clé)
 * - Premier chiffre 1 ou 2 (sexe administratif)
 * - Corse : positions 6-7 peuvent être '2A' ou '2B' (remplacement avant calcul clé)
 * - La clé est validée par isNirChecksumValid (algo INSEE)
 *
 * Refs : PLAN-2 Task 2.1, D-04, DEC-036.
 */
export const nirFormatSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, '').toUpperCase())
  .refine((value) => /^[12](?:[0-9]{4}(?:[0-9]{2}|2A|2B)[0-9]{8})$/.test(value), {
    message:
      'Le NIR doit comporter 15 chiffres : sexe, année, mois, département, commune, ordre, clé. Exemple : 1 76 05 25 974 001 12.',
  })
  .refine(isNirChecksumValid, {
    message: 'La clé de contrôle du NIR est invalide. Vérifiez la saisie.',
  });

/**
 * Adresse minimale postale Réunion.
 */
export const adresseSchema = z.object({
  ligne1: z.string().trim().min(3).max(120),
  ligne2: z.string().trim().max(120).optional(),
  code_postal: codePostalReunionSchema,
  ville: z.enum(VILLES_974, {
    errorMap: () => ({
      message: 'Sélectionnez une commune dans la liste (24 communes Réunion).',
    }),
  }),
});

export type Adresse = z.infer<typeof adresseSchema>;
