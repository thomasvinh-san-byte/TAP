import { z } from 'zod';

/**
 * Validateur input chauffeur (clôture-bis Passe 1).
 *
 * Aligné sur le schéma SQL `public.drivers` (migration 011) :
 *   nom_affichage / telephone / numero_licence / type_permis (text[])
 *   / actif. `profile_id` est rattaché plus tard (invitation chauffeur,
 *   Passe 2+) — pas exposé dans le formulaire dirigeant V1.
 *
 * `type_permis` accepte un sous-ensemble {taxi, ambulance, vsl, tpmr}
 * — la DB ne contraint pas (text[] libre) mais le zod cadre l'UI.
 */
export const TYPE_PERMIS_VALUES = [
  'taxi',
  'ambulance',
  'vsl',
  'tpmr',
] as const;
export type TypePermis = (typeof TYPE_PERMIS_VALUES)[number];

export const driverInputSchema = z.object({
  nom_affichage: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(80, 'Le nom doit faire au maximum 80 caractères.'),
  telephone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal('')),
  numero_licence: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal('')),
  type_permis: z.array(z.enum(TYPE_PERMIS_VALUES)).default([]),
  actif: z.boolean().default(true),
});

export type DriverInput = z.infer<typeof driverInputSchema>;
