import { z } from 'zod';
import { rppsSchema, adeliSchema, finessSchema } from './common';

/**
 * Validateur input prescripteur (CdG §5.4, DEC-162).
 *
 * Le prescripteur est le médecin / établissement à l'origine de la PRESCRIPTION
 * de transport. DISTINCT du donneur d'ordres (entité B2B qui commande/paie,
 * §5.5) et du patient (personne transportée). Référentiel préalable de la
 * gestion des prescriptions (§5.3, lot suivant).
 *
 * Identifiants (RPPS/ADELI/FINESS) validés en FORMAT uniquement si renseignés —
 * tous optionnels côté DB (enregistrement partiel autorisé).
 */
export const PRESCRIBER_TYPE_VALUES = ['medecin', 'etablissement'] as const;
export type PrescriberType = (typeof PRESCRIBER_TYPE_VALUES)[number];

export const prescriberInputSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(1, 'Le nom est requis.')
    .max(120, 'Le nom doit faire au maximum 120 caractères.'),
  // prenom optionnel : un établissement n'a pas de prénom.
  prenom: z.string().trim().max(120).optional().or(z.literal('')),
  type: z
    .enum(PRESCRIBER_TYPE_VALUES, {
      errorMap: () => ({ message: 'Type de prescripteur invalide.' }),
    })
    .default('medecin'),
  rpps: rppsSchema.optional().or(z.literal('')),
  adeli: adeliSchema.optional().or(z.literal('')),
  finess: finessSchema.optional().or(z.literal('')),
  specialite: z.string().trim().max(120).optional().or(z.literal('')),
  contact_telephone: z.string().trim().max(30).optional().or(z.literal('')),
  contact_email: z
    .string()
    .trim()
    .max(160)
    .email('Adresse e-mail invalide.')
    .optional()
    .or(z.literal('')),
  adresse: z.string().trim().max(200).optional().or(z.literal('')),
  actif: z.boolean().default(true),
});

export type PrescriberInput = z.infer<typeof prescriberInputSchema>;
