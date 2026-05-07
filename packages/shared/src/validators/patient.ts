import { z } from 'zod';
import {
  adresseSchema,
  telephoneReunionSchema,
  nirFormatSchema,
} from './common';

export const canalContactSchema = z.enum(['sms', 'appel', 'aucun']);
export type CanalContact = z.infer<typeof canalContactSchema>;

/**
 * Genre administratif (D-16) — liste close de 3 valeurs.
 * Aligné sur le CHECK genre in ('M','F','X') de public.patients.
 * Pas de label "autre" en clair pour respecter le mental model administratif
 * français (NIR commence par 1 ou 2 — on garde X pour les rares cas non
 * binaires sans rentrer dans un débat hors-scope V1).
 */
export const genreSchema = z.enum(['M', 'F', 'X']);
export type Genre = z.infer<typeof genreSchema>;

/**
 * Contact d'urgence — couple nom + téléphone réunionnais validé.
 * Champ optionnel sur le patient mais s'il est présent, les 2 sous-champs
 * sont obligatoires (zod object par défaut).
 */
export const contactUrgenceSchema = z.object({
  nom: z.string().trim().min(1, 'Nom requis').max(80),
  telephone: telephoneReunionSchema,
});
export type ContactUrgence = z.infer<typeof contactUrgenceSchema>;

/**
 * Normalisation NIR avant chiffrement / hash :
 * suppression des espaces et uppercase pour gérer la clé corse 2A/2B.
 * Source unique de normalisation — utiliser AVANT tout appel à l'Edge
 * Function nir-encrypt / nir-hash (PLAN-3).
 */
export function normalizeNir(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

/**
 * Normalisation téléphone — strip espaces, points, tirets.
 * Aligné avec le transform interne de telephoneReunionSchema.
 * Utilisée pour la colonne telephone_normalized (recherche fuzzy, D-09).
 */
export function normalizePhone(input: string): string {
  return input.trim().replace(/[\s.-]/g, '');
}

export const patientSchema = z
  .object({
    prenom: z.string().trim().min(1, 'Prénom requis').max(80),
    nom: z.string().trim().min(1, 'Nom requis').max(80),
    date_naissance: z
      .string()
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Format attendu : AAAA-MM-JJ'),
    genre: genreSchema.optional(),
    telephone: telephoneReunionSchema.optional(),
    // NIR optionnel : peut être saisi plus tard, chiffré côté serveur.
    nir: nirFormatSchema.optional(),
    adresse: adresseSchema,
    contact_urgence: contactUrgenceSchema.optional(),
    canal_contact_prefere: canalContactSchema.default('appel'),
    consentement_sms: z.boolean().default(false),
    consentement_sms_at: z.string().datetime({ offset: true }).optional(),
    notes_operationnelles: z.string().trim().max(500).optional(),
    archive: z.boolean().default(false),
  })
  .refine(
    (data) => !data.consentement_sms || Boolean(data.consentement_sms_at),
    {
      message: 'Horodatage de consentement requis si consentement_sms = true.',
      path: ['consentement_sms_at'],
    },
  );

export type PatientInput = z.infer<typeof patientSchema>;
