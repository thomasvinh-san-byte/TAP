import { z } from 'zod';

/**
 * Typologie des contraintes patient (D-17, 8 valeurs alignées sur l'enum
 * Postgres public.patient_constraint_type créé en migration 003).
 */
export const patientConstraintTypeSchema = z.enum([
  'medical_oxygene',
  'medical_fauteuil',
  'medical_brancard',
  'vehicule_tpmr',
  'horaire_matin',
  'horaire_apres_midi',
  'accompagnement_obligatoire',
  'autre',
]);
export type PatientConstraintType = z.infer<typeof patientConstraintTypeSchema>;

/**
 * Saisie d'une nouvelle contrainte patient. Note libre limitée à 300 chars
 * (alignée sur le CHECK SQL).
 */
export const patientConstraintInputSchema = z.object({
  patient_id: z.string().uuid('Identifiant patient invalide'),
  type: patientConstraintTypeSchema,
  note: z.string().trim().max(300).optional(),
});
export type PatientConstraintInput = z.infer<typeof patientConstraintInputSchema>;
