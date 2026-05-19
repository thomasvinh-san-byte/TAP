/**
 * TYPES TEMPORAIRES — À SUPPRIMER POST-RÉGÉNÉRATION types.gen.ts
 *
 * Contexte : ce fichier définit des interfaces TypeScript pour les tables
 * Phase 05 Wave 1 (ride_recurrences, ride_recurrence_exceptions,
 * holidays_974) qui ne sont pas encore dans
 * packages/database/src/types.gen.ts. La régénération automatique se
 * déclenchera au merge de cette PR Wave 3 (via workflow_run armé par
 * PR #127), ouvrant une PR auto chore/sync-supabase-types qui contiendra
 * les types officiels.
 *
 * Une fois cette PR auto mergée :
 *   1. Refactor les imports : remplacer
 *      `from '@/types/recurrence-temp'` par les types officiels
 *      `@tap/database/types`.
 *   2. Supprimer ce fichier.
 *   3. Mini-PR cleanup ou Wave 4.
 *
 * Ne PAS étendre ce fichier. Toute nouvelle table doit passer par
 * la régénération automatique types.gen.ts.
 */

export type TransportMode = 'vsl' | 'taxi_conventionne' | 'tpmr';
export type Urgency = 'normale' | 'prioritaire';

export interface RideRecurrence {
  id: string;
  organization_id: string;
  patient_id: string;
  prescription_id: string | null;
  rrule_str: string;
  start_date: string;
  end_date: string | null;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_citycode: string | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_citycode: string | null;
  transport_mode: TransportMode;
  urgency: Urgency;
  archived_at: string | null;
  created_by: string;
  created_at: string;
}

export type RideRecurrenceInsert = Omit<
  RideRecurrence,
  'id' | 'archived_at' | 'created_at'
> & {
  id?: string;
  archived_at?: string | null;
};

export type RideRecurrenceUpdate = Partial<
  Omit<RideRecurrence, 'id' | 'organization_id' | 'created_by' | 'created_at'>
>;

export interface RideRecurrenceException {
  id: string;
  ride_recurrence_id: string;
  excluded_date: string;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export interface Holiday974 {
  date: string;
  label: string;
}
