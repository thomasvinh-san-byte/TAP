'use client';

import { useMemo } from 'react';
import { useNow } from './use-now';
import { findUnassignedH1Rides, unassignedH1ToAlerts } from './unassigned-h1';
import type { CockpitAlert, CockpitRide } from './types';

/**
 * Hook cockpit : courses non affectées à H-1 (§5.13, COCKPIT-01). Réévalue
 * l'échéance chaque minute (ticker) — l'alerte est dérivée du temps, pas d'un
 * événement. Renvoie le compteur (indicateur) et les alertes (panneau).
 */
export function useUnassignedH1(rides: CockpitRide[]): { count: number; alerts: CockpitAlert[] } {
  const now = useNow(60_000);
  return useMemo(() => {
    const count = findUnassignedH1Rides(rides, now).length;
    return { count, alerts: unassignedH1ToAlerts(rides, now) };
  }, [rides, now]);
}
