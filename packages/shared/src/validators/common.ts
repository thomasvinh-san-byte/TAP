import { z } from 'zod';
import { VILLES_974, cpDominantVille, type Ville974 } from '../constants/villes-974';
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
      /^0(?:262|263|692|693)[0-9]{6}$/.test(value) || /^\+262(?:62|63|92|93)[0-9]{6}$/.test(value),
    {
      message: 'Le numéro doit commencer par 0262, 0263, 0692 ou 0693 (10 chiffres).',
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

/**
 * Identifiants prescripteur (CdG §5.4) — contrôle de FORMAT uniquement
 * (nombre de chiffres), pas de checksum. Tous optionnels côté DB.
 *   - RPPS : 11 chiffres (médecin, répertoire partagé des professionnels).
 *   - ADELI : 9 chiffres (ancien identifiant professionnel de santé).
 *   - FINESS : 9 chiffres (établissement sanitaire/médico-social).
 */
export const rppsSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{11}$/, { message: 'RPPS : 11 chiffres requis.' });

export const adeliSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{9}$/, { message: 'ADELI : 9 chiffres requis.' });

export const finessSchema = z
  .string()
  .trim()
  .regex(/^[0-9]{9}$/, { message: 'FINESS : 9 chiffres requis.' });

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
 * NIR — validation à deux niveaux (Phase 04.5 hotfix UX 2026-05-15).
 *
 * `nirFormatSchema` : structure INSEE 15 chiffres uniquement
 *   - sexe ∈ {1, 2}
 *   - année 2 chiffres
 *   - mois 01-12
 *   - département 2 chiffres ou 2A/2B (Corse)
 *   - commune + ordre + clé : 8 chiffres (sans validation de la clé)
 *
 * `nirChecksumSchema` : `nirFormatSchema` + vérification clé INSEE
 *   `(97 - N mod 97)` via `isNirChecksumValid` (algo INSEE complet,
 *   tests 100 % branch dans `utils/nir-checksum.test.ts`).
 *
 * `nirFieldSchema` : sélection runtime selon `NEXT_PUBLIC_NIR_CHECKSUM_STRICT`.
 *   - `'true'` → `nirChecksumSchema` (production)
 *   - autres → `nirFormatSchema` (défaut démo design partner)
 *
 * L'algorithme INSEE et ses tests unitaires sont livrés en permanence
 * (PR #80 + #83) — seule l'activation au runtime change via env var.
 * À l'arrivée en production réelle : positionner
 * `NEXT_PUBLIC_NIR_CHECKSUM_STRICT=true` sur Vercel et redéployer.
 *
 * Refs : PR #80, PR #83, hotfix UX 2026-05-15, DEC-036.
 */
export const NIR_FORMAT_REGEX = /^[12][0-9]{2}(0[1-9]|1[0-2])([0-9]{2}|2A|2B)[0-9]{8}$/;

export const isNirChecksumStrict = process.env.NEXT_PUBLIC_NIR_CHECKSUM_STRICT === 'true';

const NIR_FORMAT_MESSAGE =
  'Le NIR doit comporter 15 chiffres : sexe, année, mois, département, commune, ordre, clé. Exemple : 1 76 05 25 974 001 12.';

const NIR_CHECKSUM_MESSAGE = 'La clé de contrôle du NIR est invalide. Vérifiez la saisie.';

const nirNormalize = (value: string) => value.replace(/\s/g, '').toUpperCase();

/** Format INSEE structurel — pas de vérif clé. Suffit pour la démo. */
export const nirFormatSchema = z
  .string()
  .trim()
  .transform(nirNormalize)
  .refine((value) => NIR_FORMAT_REGEX.test(value), { message: NIR_FORMAT_MESSAGE });

/** Format INSEE + clé contrôle (97 − N mod 97) — production. */
export const nirChecksumSchema = z
  .string()
  .trim()
  .transform(nirNormalize)
  .refine((value) => NIR_FORMAT_REGEX.test(value), { message: NIR_FORMAT_MESSAGE })
  .refine(isNirChecksumValid, { message: NIR_CHECKSUM_MESSAGE });

/**
 * Schéma effectif consommé par `patientSchema` — résolu au build/runtime.
 * Démo (défaut) : format only. Production : strict avec clé INSEE.
 */
export const nirFieldSchema = isNirChecksumStrict ? nirChecksumSchema : nirFormatSchema;

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
