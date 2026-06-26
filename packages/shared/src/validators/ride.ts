import { z } from 'zod';
import { codePostalReunionSchema } from './common';

/**
 * Mode de transport (D-08, CDC v2 § 5.8).
 * 4 valeurs alignées sur l'enum Postgres ride_transport_mode (Phase 2 / Wave 1).
 */
export const rideTransportModeSchema = z.enum(['taxi_conventionne', 'tpmr', 'vsl', 'ambulance']);
export type RideTransportMode = z.infer<typeof rideTransportModeSchema>;

/**
 * Niveau d'urgence d'une course (D-08).
 */
export const rideUrgencySchema = z.enum(['programmee', 'urgente', 'immediate']);
export type RideUrgency = z.infer<typeof rideUrgencySchema>;

/**
 * Statuts d'annulation d'une course (DEC-173). SOURCE UNIQUE — toute logique qui
 * compte / filtre / affiche les courses annulées DOIT importer cette constante,
 * jamais ré-énumérer en dur. Un nouvel ajout d'enum (ex. `annulee_meteo` en
 * 12.01) faussait sinon le taux d'annulation du tableau de bord pendant un
 * épisode cyclonique. 4 valeurs alignées sur l'enum Postgres `ride_status`.
 *
 * COUPLAGE SQL (DEC-176) : tout ajout/retrait d'un statut d'annulation doit être
 * répercuté dans le trigger Postgres prescription (array `cancelled` de
 * `rides_prescription_counter`, qui inclut aussi `brouillon`). Le test
 * `cancelled-statuses-sync.test.ts` vérifie l'alignement et casse la CI en cas
 * de divergence — le couplage n'est plus une vigilance manuelle.
 */
export const RIDE_CANCELLED_STATUSES = [
  'annulee_regulateur',
  'annulee_patient',
  'annulee_chauffeur',
  'annulee_meteo',
] as const;
export type RideCancelledStatus = (typeof RIDE_CANCELLED_STATUSES)[number];

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
  scheduled_at: z.string().datetime({ offset: true, message: 'Date/heure requise' }),
  pickup_address: z.string().trim().min(3, 'Adresse de prise en charge requise').max(200),
  pickup_postal_code: codePostalReunionSchema.optional(),
  pickup_city: z.string().trim().max(80).optional(),
  dropoff_address: z.string().trim().min(3, 'Adresse de destination requise').max(200),
  dropoff_postal_code: codePostalReunionSchema.optional(),
  dropoff_city: z.string().trim().max(80).optional(),
  // Géocoding DEC-044 (Phase 04.7) — coordonnées BAN/POI optionnelles
  pickup_lat: z.number().min(-90).max(90).nullable().optional(),
  pickup_lng: z.number().min(-180).max(180).nullable().optional(),
  pickup_citycode: z.string().max(10).nullable().optional(),
  dropoff_lat: z.number().min(-90).max(90).nullable().optional(),
  dropoff_lng: z.number().min(-180).max(180).nullable().optional(),
  dropoff_citycode: z.string().max(10).nullable().optional(),
  transport_mode: rideTransportModeSchema.default('taxi_conventionne'),
  urgency: rideUrgencySchema.default('programmee'),
  notes_regulateur: z.string().trim().max(500).optional(),
  // Donneur d'ordres B2B (CdC §5.5, DEC-148) — OPTIONNEL. NULL = transport
  // prescrit individuel (cas nominal). Ne JAMAIS rendre obligatoire.
  ordering_party_id: z.string().uuid().nullable().optional(),
  // Prescription / bon de transport (CdG §5.3, DEC-163) — OPTIONNEL. NULL =
  // course non conventionnée. L'obligation conventionnée est gérée par
  // AVERTISSEMENT UI, pas par contrainte bloquante.
  prescription_id: z.string().uuid().nullable().optional(),
  // Accompagnant (CdG l.293, DEC-172) — OPTIONNEL. `accompagnant_payant`
  // n'a de sens que si `accompagnant` ; le coût est appliqué via la grille.
  accompagnant: z.boolean().default(false),
  accompagnant_payant: z.boolean().default(false),
  accompagnant_identite: z.string().trim().max(120).optional(),
});
export type RideExpressInput = z.infer<typeof rideExpressInputSchema>;

/**
 * Demande groupée B2B (DEC-158, CdC §5.5 l.191) : un donneur d'ordres commande
 * N transports en lot ; la régulation accepte/refuse. Chaque ligne reprend les
 * champs d'une course express SANS `ordering_party_id` (porté par le groupe).
 */
export const groupedRideLineSchema = rideExpressInputSchema.omit({ ordering_party_id: true });
export type GroupedRideLine = z.infer<typeof groupedRideLineSchema>;

export const rideGroupRequestSchema = z.object({
  ordering_party_id: z.string().uuid("Donneur d'ordres requis"),
  rides: z
    .array(groupedRideLineSchema)
    .min(1, 'Ajoutez au moins une course.')
    .max(50, 'Maximum 50 courses par demande groupée.'),
});
export type RideGroupRequestInput = z.infer<typeof rideGroupRequestSchema>;

/** Motif de refus d'une demande groupée (régulation). */
export const rideGroupRefusalSchema = z.object({
  motif: z.string().trim().min(1, 'Motif requis.').max(500),
});

/**
 * Brouillon de course (D-02) : tous les champs sont optionnels jusqu'au submit.
 * Persisté côté serveur dans public.ride_draft (jsonb payload).
 */
export const rideDraftSchema = rideExpressInputSchema.partial();
export type RideDraftInput = z.infer<typeof rideDraftSchema>;
