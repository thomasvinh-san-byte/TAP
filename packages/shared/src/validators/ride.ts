import { z } from 'zod';
import { codePostalReunionSchema } from './common';

/**
 * Mode de transport (D-08, CDC v2 § 5.8).
 * 4 valeurs alignées sur l'enum Postgres ride_transport_mode (Phase 2 / Wave 1).
 */
export const rideTransportModeSchema = z.enum([
  'taxi_conventionne',
  'tpmr',
  'vsl',
  'ambulance',
]);
export type RideTransportMode = z.infer<typeof rideTransportModeSchema>;

/**
 * Niveau d'urgence d'une course (D-08).
 */
export const rideUrgencySchema = z.enum(['programmee', 'urgente', 'immediate']);
export type RideUrgency = z.infer<typeof rideUrgencySchema>;

/**
 * Saisie express d'une course (CDC v2 § 5.8, DEC-005, D-08).
 * Cible : < 30 secondes pour la régulatrice (mesuré E2E SAIS-01).
 *
 * Aligné sur le schéma SQL public.rides (Wave 1, migration 004) :
 *   pickup_address / dropoff_address / scheduled_at / transport_mode / urgency
 *
 * NB : scheduled_at est validé en ISO 8601 avec offset (TZ Indian/Reunion
 * côté navigateur, UTC en DB — date-fns + DatePicker shadcn fournissent
 * l'ISO via combineToIso (cf. ride-express-form-fields, D-DTPICK-19..25).
 */
export const rideExpressInputSchema = z.object({
  patient_id: z.string().uuid('Patient requis'),
  scheduled_at: z
    .string()
    .datetime({ offset: true, message: 'Date/heure requise' }),
  pickup_address: z
    .string()
    .trim()
    .min(3, 'Adresse de prise en charge requise')
    .max(200),
  pickup_postal_code: codePostalReunionSchema.optional(),
  pickup_city: z.string().trim().max(80).optional(),
  dropoff_address: z
    .string()
    .trim()
    .min(3, 'Adresse de destination requise')
    .max(200),
  dropoff_postal_code: codePostalReunionSchema.optional(),
  dropoff_city: z.string().trim().max(80).optional(),
  transport_mode: rideTransportModeSchema.default('taxi_conventionne'),
  urgency: rideUrgencySchema.default('programmee'),
  notes_regulateur: z.string().trim().max(500).optional(),
});
export type RideExpressInput = z.infer<typeof rideExpressInputSchema>;

/**
 * Brouillon de course (D-02) : tous les champs sont optionnels jusqu'au submit.
 * Persisté côté serveur dans public.ride_draft (jsonb payload).
 */
export const rideDraftSchema = rideExpressInputSchema.partial();
export type RideDraftInput = z.infer<typeof rideDraftSchema>;
