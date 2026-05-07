import { z } from 'zod';
import { adresseSchema } from './common';

export const typeTransportSchema = z.enum(['assis', 'tpmr']);
export type TypeTransport = z.infer<typeof typeTransportSchema>;

/**
 * Saisie express d'une course (module CDC 5.8).
 * Cible : < 30 secondes pour la régulatrice, ergonomie clavier.
 *
 * Règles :
 * - patient_id OU couple (prenom, nom) + date_naissance (création à la volée)
 * - heure_souhaitee >= maintenant (validation côté serveur car timezone Réunion)
 * - type_transport par défaut "assis"
 */
export const courseExpressSchema = z
  .object({
    patient_id: z.string().uuid().optional(),
    patient_nouveau: z
      .object({
        prenom: z.string().trim().min(1).max(80),
        nom: z.string().trim().min(1).max(80),
        date_naissance: z
          .string()
          .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
      })
      .optional(),
    adresse_depart: adresseSchema,
    adresse_arrivee: adresseSchema,
    date_course: z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/),
    heure_souhaitee: z
      .string()
      .regex(/^[0-9]{2}:[0-9]{2}$/, 'Format attendu : HH:MM'),
    type_transport: typeTransportSchema.default('assis'),
    aller_retour: z.boolean().default(false),
    heure_retour: z
      .string()
      .regex(/^[0-9]{2}:[0-9]{2}$/)
      .optional(),
    prescription_id: z.string().uuid().optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine(
    (data) => Boolean(data.patient_id) !== Boolean(data.patient_nouveau),
    {
      message:
        "Renseigner soit un patient existant, soit les infos d'un nouveau patient.",
      path: ['patient_id'],
    },
  )
  .refine((data) => !data.aller_retour || Boolean(data.heure_retour), {
    message: 'Heure de retour requise pour un aller-retour.',
    path: ['heure_retour'],
  });

export type CourseExpressInput = z.infer<typeof courseExpressSchema>;
