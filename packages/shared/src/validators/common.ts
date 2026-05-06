import { z } from 'zod';

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
    { message: 'Numéro de téléphone réunionnais invalide.' },
  );

/**
 * Code postal Réunion : 974xx.
 */
export const codePostalReunionSchema = z
  .string()
  .trim()
  .regex(/^974[0-9]{2}$/, { message: 'Code postal invalide (974xx attendu).' });

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
export const nirFormatSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, ''))
  .refine((value) => /^[12][0-9]{14}$/.test(value), {
    message: 'NIR : 15 chiffres attendus, commence par 1 ou 2.',
  });

/**
 * Adresse minimale postale Réunion.
 */
export const adresseSchema = z.object({
  ligne1: z.string().trim().min(3).max(120),
  ligne2: z.string().trim().max(120).optional(),
  code_postal: codePostalReunionSchema,
  ville: z.string().trim().min(2).max(80),
});

export type Adresse = z.infer<typeof adresseSchema>;
