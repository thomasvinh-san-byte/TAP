import { z } from 'zod';
import { siretSchema } from './common';

/**
 * Validateur input donneur d'ordres B2B (CdC §5.5, DEC-148).
 *
 * Aligné sur le schéma SQL `public.ordering_parties` :
 *   raison_sociale (1-120) / siret (Luhn, optionnel) / contact principal /
 *   modalite_facturation (enum) / actif.
 *
 * DISTINCT du prescripteur (médecin émetteur du bon de transport). Le donneur
 * d'ordres est l'entité B2B qui commande le transport (hôpital, clinique,
 * EHPAD), avec convention tarifaire propre et facturation centralisée.
 *
 * SIRET validé via `siretSchema` (14 chiffres + Luhn) UNIQUEMENT s'il est
 * renseigné — il est optionnel côté DB (enregistrement partiel autorisé).
 */
export const ORDERING_PARTY_BILLING_MODALITY_VALUES = [
  'a_la_course',
  'hebdomadaire',
  'mensuelle',
] as const;
export type OrderingPartyBillingModality = (typeof ORDERING_PARTY_BILLING_MODALITY_VALUES)[number];

export const orderingPartyInputSchema = z.object({
  raison_sociale: z
    .string()
    .trim()
    .min(1, 'La raison sociale est requise.')
    .max(120, 'La raison sociale doit faire au maximum 120 caractères.'),
  // siret optionnel : champ vide accepté, sinon contrôle format + Luhn.
  siret: siretSchema.optional().or(z.literal('')),
  contact_principal_nom: z.string().trim().max(120).optional().or(z.literal('')),
  contact_principal_telephone: z.string().trim().max(30).optional().or(z.literal('')),
  contact_principal_email: z
    .string()
    .trim()
    .max(160)
    .email('Adresse e-mail invalide.')
    .optional()
    .or(z.literal('')),
  modalite_facturation: z
    .enum(ORDERING_PARTY_BILLING_MODALITY_VALUES, {
      errorMap: () => ({ message: 'Modalité de facturation invalide.' }),
    })
    .default('a_la_course'),
  actif: z.boolean().default(true),
});

export type OrderingPartyInput = z.infer<typeof orderingPartyInputSchema>;
