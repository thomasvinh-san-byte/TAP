/**
 * Alias des types officiels (re-export depuis `@tap/database`).
 *
 * Phase 05 Wave 7 (post-régénération auto types.gen.ts via cd.yml +
 * workflow_run #129) : ce fichier remplace l'ancien `recurrence-temp.ts`
 * (qui définissait des interfaces inline en attendant la régénération).
 *
 * Aliases pratiques pour éviter la verbosité
 * `Database['public']['Tables']['ride_recurrences']['Row']` répétée dans
 * les consommateurs UI.
 */

import type { Database } from '@tap/database';

export type RideRecurrence = Database['public']['Tables']['ride_recurrences']['Row'];
export type RideRecurrenceInsert = Database['public']['Tables']['ride_recurrences']['Insert'];
export type RideRecurrenceUpdate = Database['public']['Tables']['ride_recurrences']['Update'];

export type RideRecurrenceException =
  Database['public']['Tables']['ride_recurrence_exceptions']['Row'];

export type Holiday974 = Database['public']['Tables']['holidays_974']['Row'];

export type TransportMode = RideRecurrence['transport_mode'];
export type Urgency = RideRecurrence['urgency'];
