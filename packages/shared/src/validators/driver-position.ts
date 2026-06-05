import { z } from 'zod';

/**
 * Phase 10.0 prototype géoloc (DEC-096).
 *
 * Schéma partagé pour la capture de position chauffeur. Aux 3 endpoints
 * de pointage (`start`, `end`, `no-show`), `lat`/`lng`/`accuracy` sont
 * OPTIONNELS : le pointage doit aboutir même si :
 *   - le chauffeur refuse la permission GPS,
 *   - l'acquisition timeout (8s),
 *   - l'accuracy est trop mauvaise pour être exploitable.
 *
 * Le serveur lit ces 3 champs et décide d'INSERT dans `driver_positions`
 * selon le flag applicatif `GEOLOC_ENABLED`. Pré-HDS, seule la source
 * `'demo'` (seed) est persistée en production.
 */
export const driverPositionInputSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100_000).optional(),
  })
  .partial();

export type DriverPositionInput = z.infer<typeof driverPositionInputSchema>;

/** Filtrage applicatif : on ignore les positions trop floues. */
export const POSITION_MAX_ACCURACY_M = 100;
