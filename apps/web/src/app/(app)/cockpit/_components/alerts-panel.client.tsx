'use client';

import { AlertCard } from './alert-card.client';
import type { CockpitAlert } from '../_lib/types';

export function AlertsPanel({ alerts }: { alerts: CockpitAlert[] }): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <header className="mb-12 flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Alertes
        </h2>
        {alerts.length > 0 && (
          <span className="bg-destructive/10 text-destructive inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-8 text-xs font-semibold">
            {alerts.length}
          </span>
        )}
      </header>
      {alerts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune alerte.</p>
      ) : (
        <div className="flex flex-col gap-8 overflow-y-auto pr-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}
