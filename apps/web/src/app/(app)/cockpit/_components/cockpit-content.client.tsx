'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { useCockpitAlerts } from '../_lib/use-cockpit-alerts';
import { useCockpitRides } from '../_lib/use-cockpit-rides';
import type { CockpitAlert, CockpitRide } from '../_lib/types';
import type { DriverPosition } from '../_lib/use-driver-positions';
import { AlertsPanel } from './alerts-panel.client';
import { CoursesTable } from './courses-table.client';
import { DriverPositionsPanel } from './driver-positions-panel.client';
import { NoShowAlertModal } from './no-show-alert-modal.client';
import { RealtimeStatusBadge } from './realtime-status-badge.client';

const NOSHOW_DETECTION_WINDOW_MS = 60_000;
const NOSHOW_DISMISSED_KEY = 'cockpit:noshow-dismissed';

export function CockpitContent({
  initialRides,
  initialAlerts,
  initialPositions,
  driverLabels,
}: {
  initialRides: CockpitRide[];
  initialAlerts: CockpitAlert[];
  initialPositions: DriverPosition[];
  driverLabels: Record<string, string>;
}): JSX.Element {
  const { rides, status, newRideIds } = useCockpitRides(initialRides);
  const { alerts } = useCockpitAlerts(initialAlerts);
  const [dismissedNoShowIds, setDismissedNoShowIds] = useState<Set<string>>(() => new Set());

  const recentNoShow = useMemo<CockpitAlert | null>(() => {
    const cutoff = Date.now() - NOSHOW_DETECTION_WINDOW_MS;
    return (
      alerts.find((a) => {
        if (a.event_type !== 'patient_no_show') return false;
        if (dismissedNoShowIds.has(a.id)) return false;
        const ts = new Date(a.created_at).getTime();
        return !Number.isNaN(ts) && ts >= cutoff;
      }) ?? null
    );
  }, [alerts, dismissedNoShowIds]);

  const recentNoShowRide = useMemo<CockpitRide | null>(() => {
    if (!recentNoShow?.ride_id) return null;
    return rides.find((r) => r.id === recentNoShow.ride_id) ?? null;
  }, [recentNoShow, rides]);

  // Persiste les dismiss en session (refresh ne re-déclenche pas la modal).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(NOSHOW_DISMISSED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setDismissedNoShowIds(new Set(parsed.filter((v): v is string => typeof v === 'string')));
        }
      }
    } catch {
      // ignore JSON / storage errors
    }
  }, []);

  function dismissNoShow(): void {
    if (!recentNoShow) return;
    setDismissedNoShowIds((prev) => {
      const next = new Set(prev);
      next.add(recentNoShow.id);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(NOSHOW_DISMISSED_KEY, JSON.stringify(Array.from(next)));
        } catch {
          // ignore
        }
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-16 lg:flex-row lg:items-stretch lg:gap-24">
      <section className="min-w-0 flex-1 space-y-16">
        <PageHeader
          title="Ma journée"
          description={
            <>
              {rides.length} course{rides.length > 1 ? 's' : ''} planifiée
              {rides.length > 1 ? 's' : ''} aujourd&apos;hui
            </>
          }
          actions={
            <>
              <Button
                asChild
                variant="default"
                className="min-h-[44px]"
                data-testid="optimize-day-btn"
              >
                <Link href={`/cockpit/optimisation?date=${new Date().toISOString().slice(0, 10)}`}>
                  <Sparkles className="mr-8 h-16 w-16" aria-hidden />
                  Optimiser la journée
                </Link>
              </Button>
              <RealtimeStatusBadge status={status} />
            </>
          }
        />
        <CoursesTable rides={rides} newRideIds={newRideIds} />
        <DriverPositionsPanel initial={initialPositions} driverLabels={driverLabels} />
      </section>
      <aside className="lg:border-border w-full shrink-0 lg:w-80 lg:border-l lg:pl-24">
        <AlertsPanel alerts={alerts} />
      </aside>
      {recentNoShowRide && <NoShowAlertModal ride={recentNoShowRide} onClose={dismissNoShow} />}
    </div>
  );
}
