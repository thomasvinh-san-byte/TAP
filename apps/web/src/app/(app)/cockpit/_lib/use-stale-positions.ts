'use client';

import { useMemo } from 'react';
import { useNow } from './use-now';
import { findStalePositionDrivers, stalePositionsToAlerts } from './stale-positions';
import type { CockpitAlert, CockpitRide } from './types';
import type { DriverPosition } from './use-driver-positions';

/**
 * Hook cockpit : positions périmées des chauffeurs en service (§5.13,
 * COCKPIT-02). Réévalue l'âge chaque minute (ticker) — dérivé du temps, pas
 * d'un événement. Renvoie le compteur et les alertes.
 */
export function useStalePositions(
  rides: CockpitRide[],
  positionsByDriver: Map<string, DriverPosition>,
  driverLabels: Record<string, string>,
): { count: number; alerts: CockpitAlert[] } {
  const now = useNow(60_000);
  return useMemo(() => {
    const stale = findStalePositionDrivers(rides, positionsByDriver, now);
    return { count: stale.length, alerts: stalePositionsToAlerts(stale, driverLabels, now) };
  }, [rides, positionsByDriver, driverLabels, now]);
}
