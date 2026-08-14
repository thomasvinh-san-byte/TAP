import { redirect } from 'next/navigation';
import { reunionDayBoundsUtc, reunionDayKey } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { CockpitContent } from './_components/cockpit-content.client';
import type { CockpitAlert, CockpitRide } from './_lib/types';
import type { DriverPosition } from './_lib/use-driver-positions';
import { buildDriverLabels } from './_lib/driver-labels';
import { getComplianceAlerts } from '../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { getPrescriptionAlerts } from './_lib/get-prescription-alerts';
import { getCockpitAlertPreferences } from '@/lib/notifications/preferences';
import { getActiveWeatherAlert } from '../meteo/_lib/queries';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { isGeolocEnabled } from '@/lib/release-flags';
import { OfflineGate } from './_components/offline-gate.client';

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
  const { gte, lt } = reunionDayBoundsUtc(today);
  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, status, pickup_address, dropoff_address, driver_id, vehicle_id, ' +
        'pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, ' +
        'patient:patients(prenom, nom), driver:drivers(nom_affichage), ' +
        'vehicle:vehicles(immatriculation)',
    )
    .gte('scheduled_at', gte)
    .lt('scheduled_at', lt)
    // DEC-158 : exclure les courses `brouillon` (demandes groupées en attente,
    // pas encore fermes) du cockpit.
    .neq('status', 'brouillon')
    .order('scheduled_at');
  if (error) {
    console.error('[cockpit] Erreur chargement rides:', error);
  }
  // L'inférence des SELECT à embeds de `@supabase/postgrest-js` dégrade le retour
  // en `GenericStringError[]` (limitation de typage connue, cf. CONCERNS.md et
  // queries-facturation.ts) : on assertit vers le contrat `CockpitRide` (forme
  // réelle garantie à l'exécution). Ce n'est PAS une régénération de types en
  // attente — le cast reste requis tant que l'inférence des embeds ne remonte pas.
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
    const { gte, lt } = reunionDayBoundsUtc(today);
    const { data, error } = await supabase
      .from('ride_events')
      .select('id, ride_id, event_type, payload, created_at')
      .in('event_type', ['patient_no_show', 'sms_failed', 'ride_delayed'])
      .gte('created_at', gte)
      .lt('created_at', lt)
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
 * Référentiel des chauffeurs ACTIFS (RLS-filtré par organisation) — clé
 * `drivers.id`, même espace que `rides.driver_id`. Sert au panneau « Charge par
 * chauffeur » à inclure les chauffeurs sans course du jour (les plus
 * disponibles). try/catch + fallback `[]` gracieux (le cockpit ne casse jamais).
 */
async function getActiveDrivers(
  supabase: SupabaseServerClient,
): Promise<{ id: string; nom_affichage: string }[]> {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, nom_affichage')
      .eq('actif', true)
      .eq('archive', false)
      .order('nom_affichage');
    if (error) {
      console.error('[cockpit] Erreur Supabase (drivers actifs):', error);
      return [];
    }
    return (data as { id: string; nom_affichage: string }[] | null) ?? [];
  } catch {
    return [];
  }
}

/**
 * Incidents chauffeur ouverts (DEC-160) remontés comme alertes cockpit. Mappés
 * sur la forme `CockpitAlert` (event_type 'driver_incident'). try/catch +
 * fallback `[]` (table récente, ne casse jamais). La poussée temps réel des
 * incidents est un lot suivant (registre) — ici alimentation au chargement.
 */
async function getDriverIncidentAlerts(supabase: SupabaseServerClient): Promise<CockpitAlert[]> {
  try {
    const { data, error } = await supabase
      .from('driver_incidents')
      .select('id, type, started_at')
      .is('resolved_at', null)
      .order('started_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[cockpit] Erreur Supabase (incidents):', error);
      return [];
    }
    return ((data as { id: string; type: string; started_at: string }[] | null) ?? []).map((i) => ({
      id: `incident-${i.id}`,
      ride_id: null,
      event_type: 'driver_incident' as const,
      payload: { incident_type: i.type },
      created_at: i.started_at,
    }));
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
async function getDriverPositionsWithLabels(supabase: SupabaseServerClient): Promise<{
  positions: DriverPosition[];
  driverLabels: Record<string, string>;
}> {
  try {
    const { data: posData } = await supabase
      .from('driver_positions')
      .select('id, driver_id, ride_id, lat, lng, accuracy, captured_at, source')
      .order('captured_at', { ascending: false })
      .limit(200);
    const positions = (posData as DriverPosition[] | null) ?? [];

    let driverLabels: Record<string, string> = {};
    if (positions.length > 0) {
      // Résolution du nom via la colonne de liaison `drivers.profile_id`, PAS via
      // la clé primaire `drivers.id` (qui ne matcherait jamais).
      const driverAuthIds = Array.from(new Set(positions.map((p) => p.driver_id)));
      const { data: drvData } = await supabase
        .from('drivers')
        .select('id, profile_id, nom_affichage')
        .in('profile_id', driverAuthIds);
      const drv =
        (drvData as { id: string; profile_id: string | null; nom_affichage: string }[] | null) ??
        [];
      driverLabels = buildDriverLabels(drv);
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

  // Rôle : conditionne les renvois vers les écrans dirigeant-only (conformité,
  // tableau de bord). Le régulateur n'y a pas accès → aucun renvoi (pas de cul-de-sac).
  const authCtx = await getAuthContext();
  const isDirigeant = authCtx?.role === 'dirigeant';

  // Jour civil réunionnais (UTC+4), pas le jour UTC : après 20 h locale (minuit
  // UTC), `new Date().toISOString().slice(0,10)` basculait déjà à demain et
  // vidait la journée. Même helper que le planning (fix #497) — cockpit et
  // planning voient ainsi le même jour.
  const today = reunionDayKey(new Date().toISOString());

  // DEC-150 perf : les 5 sources sont INDÉPENDANTES → lancées en parallèle
  // (waterfall séquentiel supprimé). Chaque fonction encapsule son propre
  // try/catch + fallback, donc le Promise.all ne rejette jamais à cause d'une
  // table absente (dégradation gracieuse IDENTIQUE). La seule dépendance réelle
  // (driverLabels ← positions) reste séquentielle DANS getDriverPositionsWithLabels.
  const [
    rides,
    rideAlerts,
    incidentAlerts,
    positionsResult,
    complianceAlerts,
    prescriptionAlerts,
    alertPreferences,
    weatherAlert,
    driverRoster,
  ] = await Promise.all([
    getRidesToday(supabase, today),
    getCockpitRideEvents(supabase, today),
    // DEC-160 : incidents chauffeur ouverts remontés comme alertes cockpit.
    getDriverIncidentAlerts(supabase),
    getDriverPositionsWithLabels(supabase),
    // Phase 06.34 DEC-113 : alertes d'échéances réglementaires (conformité §5.21).
    getComplianceAlerts(),
    // DEC-163 : alertes prescriptions (seuil 80 % / épuisé / expiré / renouvellement).
    getPrescriptionAlerts(),
    // DEC-149 : préférences d'alertes du user (filtrage d'affichage du panel).
    getCockpitAlertPreferences(),
    // DEC-170 : bandeau « mode alerte météo actif » si un épisode est en cours.
    getActiveWeatherAlert(),
    // Référentiel chauffeurs actifs → inclut les 0 course dans « Charge ».
    getActiveDrivers(supabase),
  ]);

  // Incidents d'abord (les plus critiques pour la régulation), puis ride_events.
  const alerts = [...incidentAlerts, ...rideAlerts];

  return (
    <OfflineGate>
      <CockpitContent
        initialRides={rides}
        initialAlerts={alerts}
        initialPositions={positionsResult.positions}
        driverLabels={positionsResult.driverLabels}
        geolocEnabled={isGeolocEnabled()}
        complianceAlerts={complianceAlerts}
        prescriptionAlerts={prescriptionAlerts}
        alertPreferences={alertPreferences}
        weatherAlert={weatherAlert}
        driverRoster={driverRoster}
        isDirigeant={isDirigeant}
      />
    </OfflineGate>
  );
}
