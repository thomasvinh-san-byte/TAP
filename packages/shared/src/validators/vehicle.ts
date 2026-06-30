import { z } from 'zod';

/**
 * Validateur input véhicule (clôture-bis Passe 1).
 *
 * Aligné sur le schéma SQL `public.vehicles` (migration 012) :
 *   immatriculation / marque / modele / type (check DB) / places_assises
 *   (1-9) / places_tpmr (0-3) / actif.
 *
 * Le check `type` côté Postgres limite à {taxi_conventionne, tpmr, vsl,
 * ambulance} — on miroir ici pour cadrer l'UI. Cohérent avec
 * `public.ride_transport_mode` (rideTransportModeSchema) sans coupler
 * les deux types (un véhicule a un type, une course a un mode demandé).
 */
export const VEHICLE_TYPE_VALUES = ['taxi_conventionne', 'tpmr', 'vsl', 'ambulance'] as const;
export type VehicleType = (typeof VEHICLE_TYPE_VALUES)[number];

export const vehicleInputSchema = z.object({
  immatriculation: z
    .string()
    .trim()
    .min(1, "L'immatriculation est requise.")
    .max(20, "L'immatriculation doit faire au maximum 20 caractères."),
  marque: z.string().trim().max(40).optional().or(z.literal('')),
  modele: z.string().trim().max(40).optional().or(z.literal('')),
  type: z.enum(VEHICLE_TYPE_VALUES, {
    errorMap: () => ({ message: 'Type de véhicule invalide.' }),
  }),
  places_assises: z
    .number()
    .int()
    .min(1, 'Au moins 1 place assise.')
    .max(9, 'Au maximum 9 places assises.')
    .optional(),
  places_tpmr: z.number().int().min(0).max(3, 'Au maximum 3 places TPMR.').optional(),
  // VEHICULE-01 (§5.7) : équipements de compatibilité patient.
  equipement_oxygene: z.boolean().default(false),
  equipement_brancard: z.boolean().default(false),
  capacite_charge_kg: z
    .number()
    .int()
    .min(1, 'Capacité de charge minimale 1 kg.')
    .max(2000, 'Capacité de charge maximale 2000 kg.')
    .optional(),
  equipement_autre: z.string().trim().max(200).optional().or(z.literal('')),
  actif: z.boolean().default(true),
});

export type VehicleInput = z.infer<typeof vehicleInputSchema>;
