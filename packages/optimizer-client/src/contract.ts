/**
 * Contrat partagé solveur PDPTW — version TypeScript.
 * Miroir exact du contrat pydantic défini dans services/optimizer/models.py.
 * Synchronisation manuelle obligatoire si le schéma change (D-04, D-05).
 * Aucun champ nominatif patient : IDs opaques + coordonnées + horaires uniquement (D-08).
 */

import { z } from 'zod';

/** Version du contrat — à incrémenter si le schéma change. Synchronisé avec models.py. */
export const CONTRACT_VERSION = '1';

// ---- Requête (TS → Python) --------------------------------------------------

export const RideNodeSchema = z.object({
  id: z.string().uuid(),
  pickup: z.tuple([z.number(), z.number()]),
  dropoff: z.tuple([z.number(), z.number()]),
  scheduled_at: z.string().datetime({ offset: true }),
  urgency: z.enum(['programmee', 'urgente', 'immediate']),
  transport_mode: z.enum(['taxi_conventionne', 'tpmr', 'vsl', 'ambulance']),
});

export const VehicleNodeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['taxi', 'tpmr', 'vsl', 'ambulance']),
  places_assises: z.number().int().min(1).max(20),
  places_tpmr: z.number().int().min(0).max(4),
});

export const SolveRequestSchema = z.object({
  contract_version: z.literal(CONTRACT_VERSION),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rides: z.array(RideNodeSchema).min(1).max(200),
  vehicles: z.array(VehicleNodeSchema).min(1),
  depot: z.tuple([z.number(), z.number()]),
  correction_factor: z.number().min(1.0).max(2.0),
  avg_speed_kmh: z.number().min(10).max(120),
  time_limit_seconds: z.number().int().min(2).max(5),
});

// ---- Réponse (Python → TS) --------------------------------------------------

export const GroupementSchema = z.object({
  vehicle_id: z.string().uuid(),
  ride_ids: z.array(z.string().uuid()).min(2),
  order: z.array(z.string().uuid()),
  motif: z.string().max(120),
  gain_km_a_vide: z.number().min(0),
});

export const SolveResponseSchema = z.object({
  contract_version: z.literal(CONTRACT_VERSION),
  groupements: z.array(GroupementSchema),
  rides_non_groupees_ids: z.array(z.string().uuid()),
  rides_exclues_ids: z.array(z.string().uuid()),
  km_a_vide_estimes: z.number().min(0),
});

// ---- Types inférés ----------------------------------------------------------

export type RideNode = z.infer<typeof RideNodeSchema>;
export type VehicleNode = z.infer<typeof VehicleNodeSchema>;
export type SolveRequest = z.infer<typeof SolveRequestSchema>;
export type Groupement = z.infer<typeof GroupementSchema>;
export type SolveResponse = z.infer<typeof SolveResponseSchema>;
