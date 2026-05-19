'use client';

import { AlertCard } from './alert-card.client';
import type { CockpitAlert } from '../_lib/types';

export function AlertsPanel({ alerts }: { alerts: CockpitAlert[] }): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between mb-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Alertes
        </h2>
        {alerts.length > 0 && (
          <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-destructive/10 px-8 text-xs font-semibold text-destructive">
            {alerts.length}
          </span>
        )}
      </header>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune alerte.</p>
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
