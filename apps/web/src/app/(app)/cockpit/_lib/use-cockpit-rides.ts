'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CockpitRide, RealtimeStatus } from './types';

interface UseCockpitRidesResult {
  rides: CockpitRide[];
  status: RealtimeStatus;
  newRideIds: Set<string>;
}

/**
 * Subscription Realtime sur la table `rides` (DEC-049 channel global
 * `cockpit:rides`, scoping multi-tenant Phase 06+). Reçoit INSERT/UPDATE/
 * DELETE et applique au state. Track les rides apparus après le mount
 * (`newRideIds`) pour déclencher l'animation fade-in côté Row.
 *
 * Le payload Realtime n'inclut pas les jointures `patient`/`driver`
 * (Postgres CDC = ligne brute). Les rides arrivant via INSERT sont
 * affichés avec un placeholder name jusqu'au prochain refresh SSR ou
 * jusqu'à une enrichissement future Phase 06.
 */
export function useCockpitRides(initial: CockpitRide[]): UseCockpitRidesResult {
  const [rides, setRides] = useState<CockpitRide[]>(initial);
  const [status, setStatus] = useState<RealtimeStatus>('connected');
  const newRideIdsRef = useRef<Set<string>>(new Set());
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('cockpit:rides')
      .on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table: 'rides' },
        (payload: {
          eventType: 'INSERT' | 'UPDATE' | 'DELETE';
          new: Partial<CockpitRide> & { id?: string };
          old: Partial<CockpitRide> & { id?: string };
        }) => {
          setRides((current) => {
            if (payload.eventType === 'INSERT' && payload.new.id) {
              const insertedId = payload.new.id;
              if (current.some((r) => r.id === insertedId)) return current;
              newRideIdsRef.current.add(insertedId);
              forceRerender((n) => n + 1);
              const inserted: CockpitRide = {
                id: insertedId,
                scheduled_at: payload.new.scheduled_at ?? new Date().toISOString(),
                status: payload.new.status ?? 'validee',
                pickup_address: payload.new.pickup_address ?? '',
                dropoff_address: payload.new.dropoff_address ?? null,
                driver_id: payload.new.driver_id ?? null,
                patient: null,
                driver: null,
              };
              return [...current, inserted].sort((a, b) =>
                a.scheduled_at.localeCompare(b.scheduled_at),
              );
            }
            if (payload.eventType === 'UPDATE' && payload.new.id) {
              const updatedId = payload.new.id;
              return current.map((r) => (r.id === updatedId ? { ...r, ...payload.new } : r));
            }
            if (payload.eventType === 'DELETE' && payload.old.id) {
              const deletedId = payload.old.id;
              return current.filter((r) => r.id !== deletedId);
            }
            return current;
          });
        },
      )
      .subscribe((channelStatus: string) => {
        if (channelStatus === 'SUBSCRIBED') setStatus('connected');
        else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT')
          setStatus('reconnecting');
        else if (channelStatus === 'CLOSED') setStatus('disconnected');
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { rides, status, newRideIds: newRideIdsRef.current };
}
