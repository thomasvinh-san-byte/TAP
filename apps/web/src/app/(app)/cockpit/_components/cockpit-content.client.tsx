'use client';

import { useCockpitAlerts } from '../_lib/use-cockpit-alerts';
import { useCockpitRides } from '../_lib/use-cockpit-rides';
import type { CockpitAlert, CockpitRide } from '../_lib/types';
import { AlertsPanel } from './alerts-panel.client';
import { CoursesTable } from './courses-table.client';
import { RealtimeStatusBadge } from './realtime-status-badge.client';

export function CockpitContent({
  initialRides,
  initialAlerts,
}: {
  initialRides: CockpitRide[];
  initialAlerts: CockpitAlert[];
}): JSX.Element {
  const { rides, status, newRideIds } = useCockpitRides(initialRides);
  const { alerts } = useCockpitAlerts(initialAlerts);

  return (
    <div className="flex flex-col gap-16 lg:flex-row lg:items-stretch lg:gap-24">
      <section className="min-w-0 flex-1 space-y-16">
        <header className="flex items-center justify-between gap-16">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ma journée</h1>
            <p className="text-sm text-muted-foreground">
              {rides.length} course{rides.length > 1 ? 's' : ''} planifiée
              {rides.length > 1 ? 's' : ''} aujourd&apos;hui
            </p>
          </div>
          <RealtimeStatusBadge status={status} />
        </header>
        <CoursesTable rides={rides} newRideIds={newRideIds} />
      </section>
      <aside className="w-full shrink-0 lg:w-80 lg:border-l lg:border-border lg:pl-24">
        <AlertsPanel alerts={alerts} />
      </aside>
    </div>
  );
}
