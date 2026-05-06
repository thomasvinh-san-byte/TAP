import { z } from 'zod';
import {
  adresseSchema,
  telephoneReunionSchema,
  nirFormatSchema,
} from './common';

export const canalContactSchema = z.enum(['sms', 'appel', 'aucun']);
export type CanalContact = z.infer<typeof canalContactSchema>;

export const patientSchema = z.object({
  prenom: z.string().trim().min(1, 'Prénom requis').max(80),
  nom: z.string().trim().min(1, 'Nom requis').max(80),
  date_naissance: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Format attendu : AAAA-MM-JJ'),
  telephone: telephoneReunionSchema.optional(),
  // NIR optionnel : peut être saisi plus tard, chiffré côté serveur.
  nir: nirFormatSchema.optional(),
  adresse: adresseSchema,
  canal_contact_prefere: canalContactSchema.default('appel'),
  consentement_sms: z.boolean().default(false),
  notes_operationnelles: z.string().trim().max(500).optional(),
});

export type PatientInput = z.infer<typeof patientSchema>;
