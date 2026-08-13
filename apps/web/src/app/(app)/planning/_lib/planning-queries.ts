import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { CockpitRide } from '../../cockpit/_lib/types';

/**
 * Chargement des données de la grille planning (Module 5.12 lot A, LECTURE
 * SEULE). Réutilise le contrat `CockpitRide` (mêmes champs que le cockpit) et
 * l'étend de deux dimensions de filtre (type de course, donneur d'ordres) via
 * une table de métadonnées par course. RLS Postgres scope l'organisation.
 */

export interface PlanningRideMeta {
  transport_mode: string;
  ordering_party_id: string | null;
  ordering_party_label: string | null;
  // Groupe de mutualisation (demande groupée B2B) — indicateur de tournée lot C.
  ride_group_id: string | null;
}

export interface PlanningDriverOption {
  id: string;
  label: string;
}

export interface PlanningData {
  date: string; // YYYY-MM-DD (fuseau serveur d'entrée ; l'affichage est Réunion)
  rides: CockpitRide[];
  meta: Record<string, PlanningRideMeta>;
  drivers: PlanningDriverOption[];
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface RawPlanningRide extends CockpitRide {
  transport_mode: string;
  ordering_party_id: string | null;
  ordering_party: { raison_sociale: string | null } | null;
  ride_group_id: string | null;
}

/**
 * Courses du jour `date` (RLS-filtrées). Erreur loggée → fallback `[]` (jamais
 * de throw). Exclut les brouillons (DEC-158), comme le cockpit.
 */
async function getPlanningRides(
  supabase: SupabaseServerClient,
  date: string,
): Promise<{ rides: CockpitRide[]; meta: Record<string, PlanningRideMeta> }> {
  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, status, pickup_address, dropoff_address, driver_id, vehicle_id, ' +
        'pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, transport_mode, ordering_party_id, ' +
        'ride_group_id, ' +
        'patient:patients(prenom, nom), driver:drivers(nom_affichage), ' +
        'vehicle:vehicles(immatriculation), ordering_party:ordering_parties(raison_sociale)',
    )
    .gte('scheduled_at', `${date}T00:00:00`)
    .lte('scheduled_at', `${date}T23:59:59`)
    .neq('status', 'brouillon')
    .order('scheduled_at');
  if (error) {
    console.error('[planning] Erreur chargement rides:', error);
    return { rides: [], meta: {} };
  }
  // L'inférence des SELECT à embeds de postgrest-js dégrade en
  // `GenericStringError[]` (limitation connue, cf. cockpit/facturation) → cast
  // via `unknown` vers le contrat réel (forme garantie à l'exécution).
  const rows = (data ?? []) as unknown as RawPlanningRide[];
  const meta: Record<string, PlanningRideMeta> = {};
  for (const r of rows) {
    meta[r.id] = {
      transport_mode: r.transport_mode,
      ordering_party_id: r.ordering_party_id,
      ordering_party_label: r.ordering_party?.raison_sociale ?? null,
      ride_group_id: r.ride_group_id,
    };
  }
  return { rides: rows as CockpitRide[], meta };
}

/** Chauffeurs actifs (RLS-filtrés) — axe « chauffeurs » de la grille. */
async function getPlanningDrivers(supabase: SupabaseServerClient): Promise<PlanningDriverOption[]> {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, nom_affichage')
      .eq('actif', true)
      .eq('archive', false)
      .order('nom_affichage');
    if (error) {
      console.error('[planning] Erreur chargement chauffeurs:', error);
      return [];
    }
    return ((data as { id: string; nom_affichage: string }[] | null) ?? []).map((d) => ({
      id: d.id,
      label: d.nom_affichage,
    }));
  } catch {
    return [];
  }
}

export async function getPlanningData(date: string): Promise<PlanningData> {
  const supabase = await createClient();
  const [{ rides, meta }, drivers] = await Promise.all([
    getPlanningRides(supabase, date),
    getPlanningDrivers(supabase),
  ]);
  return { date, rides, meta, drivers };
}
