import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ComplianceKind } from '@tap/shared';
import type { VehicleRow } from '../page';

/**
 * Données de la fiche détail véhicule (VEHICULE-02). RÉUTILISE les référentiels
 * existants — véhicule (mêmes colonnes que la liste), échéances de conformité
 * par entité (`compliance_items` où `entity_type = 'vehicle'`) — sans dupliquer
 * de modèle. RLS Postgres borne à l'organisation. L'activité (courses récentes)
 * est chargée à part (`getVehicleRecentRides`).
 */

export interface VehicleDetail extends VehicleRow {
  archive: boolean;
}

export interface VehicleComplianceItem {
  id: string;
  kind: ComplianceKind;
  label: string | null;
  reference: string | null;
  issued_at: string | null;
  expires_at: string | null;
}

export interface VehicleDetailData {
  vehicle: VehicleDetail;
  /** Échéances du véhicule, la plus proche d'abord (nulls en fin). */
  compliance: VehicleComplianceItem[];
}

const VEHICLE_COLUMNS =
  'id, immatriculation, marque, modele, type, places_assises, places_tpmr, ' +
  'equipement_oxygene, equipement_brancard, capacite_charge_kg, equipement_autre, ' +
  'actif, archive, created_at';

/**
 * Charge un véhicule + ses échéances de conformité. `null` si le véhicule
 * n'existe pas ou n'appartient pas à l'organisation (la RLS filtre — l'appelant
 * renvoie alors un 404).
 */
export async function getVehicleDetail(id: string): Promise<VehicleDetailData | null> {
  const supabase = await createClient();

  const vehicleRes = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (vehicleRes.error || !vehicleRes.data) return null;
  // Colonnes équipement absentes de types.gen.ts (cf. cached-queries) → cast.
  const vehicle = vehicleRes.data as unknown as VehicleDetail;

  const complianceRes = await supabase
    .from('compliance_items')
    .select('id, kind, label, reference, issued_at, expires_at')
    .eq('entity_type', 'vehicle')
    .eq('entity_id', id)
    .eq('archive', false)
    .order('expires_at', { ascending: true, nullsFirst: false });
  const compliance = (complianceRes.data as VehicleComplianceItem[] | null) ?? [];

  return { vehicle, compliance };
}

export interface VehicleRecentRide {
  id: string;
  scheduled_at: string;
  status: string;
  patient_nom: string;
  patient_prenom: string;
  dropoff_address: string | null;
}

interface RawRecentRide {
  id: string;
  scheduled_at: string;
  status: string;
  dropoff_address: string | null;
  patient: { nom: string; prenom: string } | null;
}

/**
 * Courses récentes rattachées au véhicule (`vehicle_id`) — activité du véhicule,
 * les plus récentes d'abord. RÉUTILISE le champ `vehicle_id` déjà en base ; RLS
 * borne à l'organisation.
 */
export async function getVehicleRecentRides(id: string, limit = 8): Promise<VehicleRecentRide[]> {
  const supabase = await createClient();
  const res = await supabase
    .from('rides')
    .select('id, scheduled_at, status, dropoff_address, patient:patients(nom, prenom)')
    .eq('vehicle_id', id)
    .order('scheduled_at', { ascending: false })
    .limit(limit);
  const rows = (res.data as unknown as RawRecentRide[] | null) ?? [];
  return rows.map((r) => ({
    id: r.id,
    scheduled_at: r.scheduled_at,
    status: r.status,
    patient_nom: r.patient?.nom ?? '',
    patient_prenom: r.patient?.prenom ?? '',
    dropoff_address: r.dropoff_address,
  }));
}
