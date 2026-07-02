'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Phase 10.0 prototype géoloc (DEC-096).
 *
 * Hook calqué sur `use-cockpit-rides` : subscription Supabase Realtime
 * sur `driver_positions`. On garde uniquement la DERNIÈRE position
 * connue par chauffeur (Map<driverId, position>) — c'est ce que la
 * carte cockpit affiche.
 *
 * Honnêteté produit : on n'invente JAMAIS une position. Les chauffeurs
 * sans position connue n'apparaissent pas sur la carte. Le label
 * « vu il y a X min » est calculé à partir de `captured_at`.
 */

export interface DriverPosition {
  id: string;
  driver_id: string;
  ride_id: string | null;
  lat: number;
  lng: number;
  accuracy: number | null;
  captured_at: string;
  source: 'event' | 'foreground' | 'demo';
}

interface UseDriverPositionsResult {
  positionsByDriver: Map<string, DriverPosition>;
}

export function useDriverPositions(initial: DriverPosition[]): UseDriverPositionsResult {
  const [positions, setPositions] = useState<Map<string, DriverPosition>>(() => {
    const map = new Map<string, DriverPosition>();
    for (const p of initial) {
      const existing = map.get(p.driver_id);
      if (!existing || existing.captured_at < p.captured_at) {
        map.set(p.driver_id, p);
      }
    }
    return map;
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('cockpit:driver_positions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_positions' },
        (payload: { new: DriverPosition }) => {
          const fresh = payload.new;
          if (!fresh?.driver_id || !fresh.captured_at) return;
          setPositions((current) => {
            const existing = current.get(fresh.driver_id);
            if (existing && existing.captured_at >= fresh.captured_at) return current;
            const next = new Map(current);
            next.set(fresh.driver_id, fresh);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return { positionsByDriver: positions };
}

/**
 * Renvoie un libellé court d'âge (« vu il y a Xmin », « vu il y a 1h12 »).
 * Au-delà de 24 h on tombe sur la date courte.
 */
const NBSP = '\u00A0';

export function formatPositionAge(capturedAt: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(capturedAt).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (minutes < 1) return 'vu à l’instant';
  if (minutes < 60) return `vu il y a ${minutes}${NBSP}min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return `vu il y a ${hours}${NBSP}h${rem.toString().padStart(2, '0')}`;
  const days = Math.floor(hours / 24);
  return `vu il y a ${days}${NBSP}j`;
}

/**
 * Seuil de péremption d'une position (minutes). Au-delà, la position est
 * considérée « périmée » — pour la couleur (display) ET l'alerte cockpit
 * (COCKPIT-02). Source unique pour éviter un seuil divergent.
 */
export const POSITION_STALE_MIN = 5;

/** Plage de couleur : moins du seuil = primary, sinon muted. */
export function positionTone(capturedAt: string, now: Date = new Date()): 'primary' | 'muted' {
  const diffMin = (now.getTime() - new Date(capturedAt).getTime()) / 60_000;
  return diffMin < POSITION_STALE_MIN ? 'primary' : 'muted';
}
