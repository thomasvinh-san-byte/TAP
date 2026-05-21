/**
 * Queries RSC du module saisie express course (Phase 2 / Wave 2).
 *
 * Lectures RLS-protégées appelables depuis Server Components ; aucune logique
 * métier — juste lecture filtrée par RLS Postgres + reformulation FR des erreurs.
 *
 * Décisions appliquées (cf. .planning/phases/02-saisie-express-course/02-CONTEXT.md) :
 *   - D-07 : `listRides` est consommée par /courses (Wave 4) en prefetch RSC
 *   - specifics §11.4 : `listRecentPickupAddresses` retourne ≤ 5 adresses
 *     pickup distinctes du patient pour l'auto-suggestion (gain SAIS-01)
 *
 * Notes sécurité :
 *   - RLS Phase 2 Wave 1 :
 *       * rides : SELECT same_org (visible aux régulateurs/dirigeants/chauffeurs
 *         de l'org — le filtre par chauffeur viendra Phase 6 via driver_id)
 *       * ride_draft : author_id = auth.uid() AND organization_id = current_org
 *   - Aucun import direct `@supabase/*` ; uniquement le wrapper `@/lib/supabase/server`.
 *   - Erreurs Postgres jamais exposées brut (CLAUDE.md § 6 anti-pattern).
 */

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@tap/database/types';

export type RideRow = Database['public']['Tables']['rides']['Row'] & {
  // TODO(types) : colonnes Passe 1 absentes de types.gen.ts (régénérées nightly).
  driver_id?: string | null;
  vehicle_id?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  tarif_amount_eur?: number | null;
  tarif_source?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_received_at?: string | null;
};
export type RideDraftRow = Database['public']['Tables']['ride_draft']['Row'];
export type RideTransportMode = Database['public']['Enums']['ride_transport_mode'];
export type RideUrgency = Database['public']['Enums']['ride_urgency'];
export type RideStatus = Database['public']['Enums']['ride_status'];

export type PatientMin = {
  id: string;
  nom: string;
  prenom: string;
};

export type DriverMin = {
  id: string;
  nom_affichage: string;
  type_permis: string[];
};

export type VehicleMin = {
  id: string;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  type: string;
};

export type RideRowEnriched = RideRow & {
  patient: PatientMin | null;
  driver: DriverMin | null;
  vehicle: VehicleMin | null;
};

const RIDE_COLUMNS =
  'id, organization_id, patient_id, scheduled_at, ' +
  'pickup_address, pickup_postal_code, pickup_city, ' +
  'dropoff_address, dropoff_postal_code, dropoff_city, ' +
  'transport_mode, urgency, status, notes_regulateur, ' +
  'archive, created_at, updated_at, created_by, updated_by, ' +
  'driver_id, vehicle_id, started_at, ended_at, ' +
  'tarif_amount_eur, tarif_source, payment_status, payment_method, ' +
  'payment_received_at';

/**
 * Liste des courses RLS-filtrées (org courante).
 * Tri `scheduled_at desc`, limit 100, exclu archive=true.
 * Filtres optionnels : status, transport_mode, urgency.
 */
export async function listRides(
  params: {
    status?: RideStatus;
    transport_mode?: RideTransportMode;
    urgency?: RideUrgency;
  } = {},
): Promise<RideRow[]> {
  const supabase = createClient();
  let q = supabase
    .from('rides')
    .select(RIDE_COLUMNS)
    .eq('archive', false)
    .order('scheduled_at', { ascending: false })
    .limit(100);
  if (params.status) q = q.eq('status', params.status);
  if (params.transport_mode) q = q.eq('transport_mode', params.transport_mode);
  if (params.urgency) q = q.eq('urgency', params.urgency);
  const { data, error } = await q;
  if (error) throw new Error('Lecture courses impossible.');
  return (data ?? []) as RideRow[];
}

/**
 * Brouillons RLS-filtrés author-scoped (RLS auto-applique
 * `author_id = auth.uid() AND organization_id = current_organization_id()`).
 * Tri `updated_at desc`, limit 20 (CDC v2 § 5.8 — file d'attente raisonnable).
 */
export async function listDrafts(): Promise<RideDraftRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ride_draft')
    .select('id, organization_id, author_id, patient_id, payload, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw new Error('Lecture brouillons impossible.');
  return (data ?? []) as RideDraftRow[];
}

/**
 * Listes enrichies + référentiels drivers/vehicles + audit log → fichier
 * dédié pour respecter la limite CLAUDE.md § 11 (≤ 300 lignes par fichier) :
 *   - listRidesEnriched / getRideByIdEnriched / getRideAuditLog
 *   - listActiveDrivers / listActiveVehicles
 * Cf. `./queries-enriched.ts`.
 */
export {
  listRidesEnriched,
  getRideByIdEnriched,
  getRideAuditLog,
  listActiveDrivers,
  listActiveVehicles,
  type RideAuditEntry,
} from './queries-enriched';

/**
 * Top 5 adresses pickup distinctes du patient (specifics §11.4).
 * Améliore SAIS-01 par auto-suggestion sans tap-tap-tap.
 *
 * On lit les 20 dernières lignes par `created_at desc` puis on déduplique en JS
 * (Postgres `distinct on` complique la combinaison `order by created_at desc`
 * sans CTE — la dédup JS sur 20 lignes est triviale et garde la query simple).
 */
export async function listRecentPickupAddresses(patientId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('rides')
    .select('pickup_address, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!data) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data) {
    const addr = (row as { pickup_address: string }).pickup_address;
    if (addr && !seen.has(addr)) {
      seen.add(addr);
      result.push(addr);
      if (result.length >= 5) break;
    }
  }
  return result;
}
