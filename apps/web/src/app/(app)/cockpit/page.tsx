import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CockpitContent } from './_components/cockpit-content.client';
import type { CockpitAlert, CockpitRide } from './_lib/types';

export const metadata = { title: 'Cockpit' };
export const dynamic = 'force-dynamic';

export default async function CockpitPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const today = new Date().toISOString().slice(0, 10);

  const { data: ridesData, error: ridesError } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, status, pickup_address, dropoff_address, ' +
        'patient:patients(prenom, nom), driver:drivers(nom_affichage)',
    )
    .gte('scheduled_at', `${today}T00:00:00`)
    .lte('scheduled_at', `${today}T23:59:59`)
    .order('scheduled_at');

  if (ridesError) {
    console.error('[cockpit] Erreur chargement rides:', ridesError);
  }

  // ride_events table sera créée Wave 6. Fallback gracieux jusque-là :
  // try/catch silencieux pour éviter de casser le cockpit si la table est
  // absente dans l'environnement courant.
  let alerts: CockpitAlert[] = [];
  try {
    const { data: alertsData, error: alertsError } = await supabase
      .from('ride_events' as never)
      .select('id, ride_id, event_type, payload, created_at')
      .in('event_type', ['patient_no_show', 'sms_failed', 'ride_delayed'])
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (alertsError) {
      console.error('[cockpit] Erreur Supabase (alerts):', alertsError);
    }
    alerts = (alertsData as CockpitAlert[] | null) ?? [];
  } catch {
    alerts = [];
  }

  // TODO(audit D+A lot 3) : ce cast écrase le typage inféré. Il a permis au
  // bug drivers(prenom, nom) de passer typecheck (lot 1). À remplacer par un
  // type dérivé de Database['public']['Tables']['rides']['Row'] + joins.
  const rides = (ridesData as CockpitRide[] | null) ?? [];

  return <CockpitContent initialRides={rides} initialAlerts={alerts} />;
}
