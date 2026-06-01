/**
 * Queries enrichies + référentiels drivers/vehicles + audit log (Phase 3 / 03-D).
 *
 * Séparé de `queries.ts` pour respecter la limite CLAUDE.md § 11 (≤ 300 lignes).
 * Pattern identique à `_lib/queries.ts` Phase 2 :
 *   - 1 SELECT principal RLS-filtré
 *   - N fetchs `in` pour joindre patient / driver / vehicle
 *   - Aggregation JS, types stricts côté retour
 *
 * RLS Postgres (drivers_select_same_org, vehicles_select_same_org,
 * rides_select_same_org, audit_logs_select_same_org) garantit l'isolation
 * tenant — les casts `as never` ne contournent que le typage TS jusqu'à
 * régénération de types.gen.ts (cron nightly).
 */

import { createClient } from '@/lib/supabase/server';
import type {
  DriverMin,
  PatientMin,
  RideRow,
  RideRowEnriched,
  RideStatus,
  RideTransportMode,
  RideUrgency,
  VehicleMin,
} from './queries';

const RIDE_COLUMNS =
  'id, organization_id, patient_id, scheduled_at, ' +
  'pickup_address, pickup_postal_code, pickup_city, ' +
  'dropoff_address, dropoff_postal_code, dropoff_city, ' +
  'transport_mode, urgency, status, notes_regulateur, ' +
  'archive, created_at, updated_at, created_by, updated_by, ' +
  'driver_id, vehicle_id, started_at, ended_at, ' +
  'tarif_amount_eur, tarif_source, payment_status, payment_method, ' +
  'payment_received_at';

export async function listRidesEnriched(
  params: {
    status?: RideStatus;
    transport_mode?: RideTransportMode;
    urgency?: RideUrgency;
    /** Hotfix 04.7-bis : filtre date scheduled_at (YYYY-MM-DD, jour entier). */
    date?: string;
    /** Hotfix 04.7-bis : pagination simple — défaut 50, max 200. */
    limit?: number;
    /** Hotfix 04.7-bis : offset pour bouton « Voir plus ». */
    offset?: number;
  } = {},
): Promise<RideRowEnriched[]> {
  const supabase = createClient();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  let q = supabase
    .from('rides')
    .select(RIDE_COLUMNS)
    .eq('archive', false)
    .order('scheduled_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (params.status) q = q.eq('status', params.status);
  if (params.transport_mode) q = q.eq('transport_mode', params.transport_mode);
  if (params.urgency) q = q.eq('urgency', params.urgency);
  if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    // Filtre jour entier : scheduled_at ∈ [date 00:00:00 UTC, date 23:59:59 UTC]
    const dateStart = `${params.date}T00:00:00.000Z`;
    const dateEnd = `${params.date}T23:59:59.999Z`;
    q = q.gte('scheduled_at', dateStart).lte('scheduled_at', dateEnd);
  }
  const { data, error } = await q;
  if (error) throw new Error('Lecture courses impossible.');
  const rides = (data ?? []) as unknown as RideRow[];
  if (rides.length === 0) return [];

  const patientIds = unique(rides.map((r) => r.patient_id));
  const driverIds = unique(rides.map((r) => r.driver_id ?? null));
  const vehicleIds = unique(rides.map((r) => r.vehicle_id ?? null));

  const [patientsRes, driversRes, vehiclesRes] = await Promise.all([
    patientIds.length === 0
      ? Promise.resolve({ data: [] as PatientMin[] })
      : supabase.from('patients_safe').select('id, nom, prenom').in('id', patientIds),
    driverIds.length === 0
      ? Promise.resolve({ data: [] as DriverMin[] })
      : supabase
          .from('drivers' as never)
          .select('id, nom_affichage, type_permis')
          .in('id', driverIds),
    vehicleIds.length === 0
      ? Promise.resolve({ data: [] as VehicleMin[] })
      : supabase
          .from('vehicles' as never)
          .select('id, immatriculation, marque, modele, type')
          .in('id', vehicleIds),
  ]);

  const patients = byId((patientsRes.data ?? []) as PatientMin[]);
  const drivers = byId((driversRes.data ?? []) as DriverMin[]);
  const vehicles = byId((vehiclesRes.data ?? []) as VehicleMin[]);

  return rides.map((r) => ({
    ...r,
    patient: patients.get(r.patient_id) ?? null,
    driver: r.driver_id ? (drivers.get(r.driver_id) ?? null) : null,
    vehicle: r.vehicle_id ? (vehicles.get(r.vehicle_id) ?? null) : null,
  }));
}

export async function getRideByIdEnriched(rideId: string): Promise<RideRowEnriched | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('rides')
    .select(RIDE_COLUMNS)
    .eq('id', rideId)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as unknown as RideRow;

  const [patientRes, driverRes, vehicleRes] = await Promise.all([
    supabase.from('patients_safe').select('id, nom, prenom').eq('id', r.patient_id).maybeSingle(),
    r.driver_id
      ? supabase
          .from('drivers' as never)
          .select('id, nom_affichage, type_permis')
          .eq('id', r.driver_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    r.vehicle_id
      ? supabase
          .from('vehicles' as never)
          .select('id, immatriculation, marque, modele, type')
          .eq('id', r.vehicle_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...r,
    patient: (patientRes.data as PatientMin | null) ?? null,
    driver: (driverRes.data as DriverMin | null) ?? null,
    vehicle: (vehicleRes.data as VehicleMin | null) ?? null,
  };
}

export type RideAuditEntry = {
  id: string;
  created_at: string;
  action: string;
  actor_id: string | null;
  actor_role: string | null;
  metadata: Record<string, unknown>;
};

export async function getRideAuditLog(rideId: string): Promise<RideAuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, created_at, action, actor_id, actor_role, metadata')
    .eq('entity_type', 'ride')
    .eq('entity_id', rideId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    console.error('[courses/audit] Erreur Supabase:', error);
  }
  return (data ?? []) as RideAuditEntry[];
}

export async function listActiveDrivers(): Promise<DriverMin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('drivers' as never)
    .select('id, nom_affichage, type_permis')
    .eq('actif', true)
    .eq('archive', false)
    .order('nom_affichage', { ascending: true })
    .limit(50);
  if (error) {
    console.error('[courses/drivers] Erreur Supabase:', error);
  }
  return (data ?? []) as DriverMin[];
}

export async function listActiveVehicles(): Promise<VehicleMin[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('vehicles' as never)
    .select('id, immatriculation, marque, modele, type')
    .eq('actif', true)
    .eq('archive', false)
    .order('immatriculation', { ascending: true })
    .limit(50);
  if (error) {
    console.error('[courses/vehicles] Erreur Supabase:', error);
  }
  return (data ?? []) as VehicleMin[];
}

function unique(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter((x): x is string => !!x)));
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) if (r.id) m.set(r.id, r);
  return m;
}
