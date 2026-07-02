'use client';

import * as React from 'react';
import { Battery, BatteryCharging, BatteryLow } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * <BatteryStatusBadge> — indicateur de batterie chauffeur (PWA-04, §5.16).
 *
 * Posé dans le header à côté de l'indicateur de connexion, même esprit visuel.
 * Alerte visible sous 20 % (hors charge). Utilise l'API navigateur standard
 * `navigator.getBattery()`.
 *
 * Dégradation propre (impératif) : cette API n'existe pas sur tous les
 * navigateurs (notamment iOS Safari). En son absence — ou avant résolution —
 * on n'affiche RIEN plutôt qu'une valeur fausse. Aucune fonction critique n'en
 * dépend.
 */

interface BatteryManagerLike {
  level: number; // 0..1
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}
type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManagerLike>;
};

const LOW_THRESHOLD = 0.2; // un cinquième de charge (CDC §5.16)

export function BatteryStatusBadge(): JSX.Element | null {
  const [state, setState] = React.useState<{ level: number; charging: boolean } | null>(null);

  React.useEffect(() => {
    const nav = navigator as NavigatorWithBattery;
    if (typeof nav.getBattery !== 'function') return; // API absente → rien

    let manager: BatteryManagerLike | null = null;
    let cancelled = false;
    const update = () => {
      if (manager) setState({ level: manager.level, charging: manager.charging });
    };

    nav
      .getBattery()
      .then((battery) => {
        if (cancelled) return;
        manager = battery;
        update();
        battery.addEventListener('levelchange', update);
        battery.addEventListener('chargingchange', update);
      })
      .catch(() => {
        /* indisponible → on reste sans affichage */
      });

    return () => {
      cancelled = true;
      if (manager) {
        manager.removeEventListener('levelchange', update);
        manager.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  if (!state) return null; // pas d'API / pas encore résolu → aucune valeur affichée

  const pct = Math.round(state.level * 100);
  const low = state.level <= LOW_THRESHOLD && !state.charging;
  const Icon = state.charging ? BatteryCharging : low ? BatteryLow : Battery;

  return (
    <div
      role="status"
      aria-label={`Batterie ${pct}%${state.charging ? ', en charge' : ''}${low ? ', niveau bas' : ''}`}
      className={cn(
        'inline-flex items-center gap-4 rounded-full px-8 py-4 text-sm tabular-nums',
        low ? 'animate-pulse bg-amber-100 text-amber-900' : 'text-muted-foreground',
      )}
    >
      <Icon aria-hidden className="h-16 w-16" />
      <span>{pct}%</span>
    </div>
  );
}
