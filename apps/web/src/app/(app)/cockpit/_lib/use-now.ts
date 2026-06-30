'use client';

import { useEffect, useState } from 'react';

/**
 * Horloge réactive : renvoie `Date.now()` rafraîchi périodiquement. Sert aux
 * alertes dérivées du TEMPS (échéance H-1) qui doivent être réévaluées même
 * sans événement entrant. Léger (1 setState/intervalle) — défaut 1 min.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
