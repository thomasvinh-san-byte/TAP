import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CockpitContent } from './_components/cockpit-content.client';
import type { CockpitAlert, CockpitRide } from './_lib/types';
import type { DriverPosition } from './_lib/use-driver-positions';
import { getComplianceAlerts } from '../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { getCockpitAlertPreferences } from '@/lib/notifications/preferences';

export const metadata = { title: 'Cockpit' };
export const dynamic = 'force-dynamic';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Courses du jour (RLS-filtrées). Erreur loggée → fallback `[]` (jamais de
 * throw), pour entrer sans risque dans le `Promise.all`.
 */
async function getRidesToday(
  supabase: SupabaseServerClient,
  today: string,
): Promise<CockpitRide[]> {
  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, status, pickup_address, dropoff_address, ' +
        'patient:patients(prenom, nom), driver:drivers(nom_affichage)',
    )
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    // DEC-158 : exclure les courses `brouillon` (demandes groupées en attente,
    // pas encore fermes) du cockpit.
    .neq('status', 'brouillon')
    .order('scheduled_at');
  if (error) {
    console.error('[cockpit] Erreur chargement rides:', error);
  }
  // TODO(audit D+A lot 3) : ce cast écrase le typage inféré. À remplacer par un
  // type dérivé de Database['public']['Tables']['rides']['Row'] + joins.
  return (data as CockpitRide[] | null) ?? [];
}

/**
 * Alertes course (ride_events). Table créée Wave 6 : try/catch + fallback `[]`
 * gracieux si elle est absente de l'environnement courant (dégradation
 * IDENTIQUE à avant — le cockpit ne casse jamais).
 */
async function getCockpitRideEvents(
  supabase: SupabaseServerClient,
  today: string,
): Promise<CockpitAlert[]> {
  try {
    const { data, error } = await supabase
      .from('ride_events')
      .select('id, ride_id, event_type, payload, created_at')
      .in('event_type', ['patient_no_show', 'sms_failed', 'ride_delayed'])
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[cockpit] Erreur Supabase (alerts):', error);
    }
    return (data as CockpitAlert[] | null) ?? [];
  } catch {
    return [];
  }
}

/**
 * Dernières positions chauffeurs + libellés (Phase 10.0, DEC-096). Le lookup
 * `driverLabels` DÉPEND des positions → il reste séquentiel À L'INTÉRIEUR de
 * cette fonction (vraie dépendance), mais la fonction entière est indépendante
 * des autres fetchs → parallélisable. try/catch + fallback gracieux préservés.
 */
async function getDriverPositionsWithLabels(
  supabase: SupabaseServerClient,
): Promise<{ positions: DriverPosition[]; driverLabels: Record<string, string> }> {
  try {
    const { data: posData } = await supabase
      .from('driver_positions')
      .select('id, driver_id, ride_id, lat, lng, accuracy, captured_at, source')
      .order('captured_at', { ascending: false })
      .limit(200);
    const positions = (posData as DriverPosition[] | null) ?? [];

    let driverLabels: Record<string, string> = {};
    if (positions.length > 0) {
      const driverIds = Array.from(new Set(positions.map((p) => p.driver_id)));
      const { data: drvData } = await supabase
        .from('drivers')
        .select('id, nom_affichage')
        .in('id', driverIds);
      const drv = (drvData as { id: string; nom_affichage: string }[] | null) ?? [];
      driverLabels = Object.fromEntries(drv.map((d) => [d.id, d.nom_affichage]));
    }
    return { positions, driverLabels };
  } catch (err) {
    console.error('[cockpit] driver_positions non disponible:', err);
    return { positions: [], driverLabels: {} };
  }
}

export default async function CockpitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);

  // DEC-150 perf : les 5 sources sont INDÉPENDANTES → lancées en parallèle
  // (waterfall séquentiel supprimé). Chaque fonction encapsule son propre
  // try/catch + fallback, donc le Promise.all ne rejette jamais à cause d'une
  // table absente (dégradation gracieuse IDENTIQUE). La seule dépendance réelle
  // (driverLabels ← positions) reste séquentielle DANS getDriverPositionsWithLabels.
  const [rides, alerts, positionsResult, complianceAlerts, alertPreferences] = await Promise.all([
    getRidesToday(supabase, today),
    getCockpitRideEvents(supabase, today),
    getDriverPositionsWithLabels(supabase),
    // Phase 06.34 DEC-113 : alertes d'échéances réglementaires (conformité §5.21).
    getComplianceAlerts(),
    // DEC-149 : préférences d'alertes du user (filtrage d'affichage du panel).
    getCockpitAlertPreferences(),
  ]);

  return (
    <CockpitContent
      initialRides={rides}
      initialAlerts={alerts}
      initialPositions={positionsResult.positions}
      driverLabels={positionsResult.driverLabels}
      complianceAlerts={complianceAlerts}
      alertPreferences={alertPreferences}
    />
  );
}
