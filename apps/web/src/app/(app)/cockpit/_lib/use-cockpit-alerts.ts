'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CockpitAlert, CockpitAlertType } from './types';

const TRACKED_TYPES: ReadonlySet<CockpitAlertType> = new Set([
  'patient_no_show',
  'sms_failed',
  'ride_delayed',
]);

const MAX_ALERTS = 20;

/**
 * Subscription Realtime sur `ride_events`. postgres_changes ne supporte pas
 * de filter IN multi-valeurs natif — on filtre côté client (volume faible,
 * <20 events/jour attendus). La table `ride_events` est créée en Wave 6 ;
 * la subscription tombe silencieusement si la table n'existe pas encore.
 */
export function useCockpitAlerts(initial: CockpitAlert[]): { alerts: CockpitAlert[] } {
  const [alerts, setAlerts] = useState<CockpitAlert[]>(initial);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('cockpit:ride_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ride_events' },
        (payload: { new: CockpitAlert }) => {
          const incoming = payload.new;
          if (!TRACKED_TYPES.has(incoming.event_type)) return;
          setAlerts((current) => [incoming, ...current].slice(0, MAX_ALERTS));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { alerts };
}
