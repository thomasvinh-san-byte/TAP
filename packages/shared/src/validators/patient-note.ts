import { z } from 'zod';

/**
 * Saisie d'une nouvelle note opérationnelle patient (D-18, modèle
 * historique en chaîne via replaced_by_id côté SQL). Cap 500 chars
 * aligné sur le CHECK de public.patient_operational_note.content.
 */
export const patientOperationalNoteInputSchema = z.object({
  patient_id: z.string().uuid('Identifiant patient invalide'),
  content: z
    .string()
    .trim()
    .min(1, 'Contenu requis')
    .max(500, 'Note limitée à 500 caractères'),
});
export type PatientOperationalNoteInput = z.infer<
  typeof patientOperationalNoteInputSchema
>;
