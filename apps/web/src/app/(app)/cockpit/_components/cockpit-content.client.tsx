'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, CloudLightning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import type { WeatherAlert } from '../../meteo/_lib/queries';
import { useCockpitAlerts } from '../_lib/use-cockpit-alerts';
import { useCockpitRides } from '../_lib/use-cockpit-rides';
import { useUnassignedH1 } from '../_lib/use-unassigned-h1';
import { sortAlertsByPriority } from '../_lib/alert-priority';
import { useAlertSound, useAlertSoundOnNew } from '@/lib/alert-sound/use-alert-sound';
import type { CockpitAlert, CockpitRide } from '../_lib/types';
import type { CockpitAlertPreferences } from '@/lib/notifications/preferences';
import type { DriverPosition } from '../_lib/use-driver-positions';
import type { ComplianceAlertEnriched } from '../../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { ComplianceAlertsPanel } from '../../../(admin)/admin/conformite/_components/compliance-alerts-panel.client';
import type { PrescriptionAlertEnriched } from '../_lib/get-prescription-alerts';
import { PrescriptionAlertsPanel } from './prescription-alerts-panel.client';
import { AlertsPanel } from './alerts-panel.client';
import { UnassignedH1Indicator } from './unassigned-h1-indicator.client';
import { AlertSoundToggle } from './alert-sound-toggle.client';
import { DraftsIndicator } from './drafts-indicator.client';
import { CoursesTable } from './courses-table.client';
import { DriverPositionsPanel } from './driver-positions-panel.client';
import { NoShowAlertModal } from './no-show-alert-modal.client';
import { RealtimeStatusBadge } from './realtime-status-badge.client';

const NOSHOW_DETECTION_WINDOW_MS = 60_000;
const NOSHOW_DISMISSED_KEY = 'cockpit:noshow-dismissed';
const MAX_PANEL_ALERTS = 20;

export function CockpitContent({
  initialRides,
  initialAlerts,
  initialPositions,
  driverLabels,
  complianceAlerts,
  prescriptionAlerts,
  alertPreferences,
  weatherAlert,
}: {
  initialRides: CockpitRide[];
  initialAlerts: CockpitAlert[];
  initialPositions: DriverPosition[];
  driverLabels: Record<string, string>;
  complianceAlerts: ComplianceAlertEnriched[];
  prescriptionAlerts: PrescriptionAlertEnriched[];
  alertPreferences: CockpitAlertPreferences;
  weatherAlert: WeatherAlert | null;
}): JSX.Element {
  const { rides, status, newRideIds } = useCockpitRides(initialRides);
  const { alerts } = useCockpitAlerts(initialAlerts);
  const [dismissedNoShowIds, setDismissedNoShowIds] = useState<Set<string>>(() => new Set());

  // COCKPIT-01 (§5.13) : courses validées non affectées à H-1 (calculées, ticker).
  const { count: unassignedH1Count, alerts: h1Alerts } = useUnassignedH1(rides);
  // Son d'alerte réutilisable, armé par interaction (politique autoplay).
  const sound = useAlertSound();
  useAlertSoundOnNew(
    useMemo(() => h1Alerts.map((a) => a.id), [h1Alerts]),
    sound,
  );

  // DEC-149 : filtrage d'AFFICHAGE selon les préférences utilisateur. La
  // détection (useCockpitAlerts, realtime) reste INCHANGÉE — on ne masque que
  // les familles désactivées. Défaut tout activé = rétro-compatible.
  // DEC-160 : `driver_incident` n'a pas (encore) de préférence dédiée → affiché
  // par défaut (`!== false`). Les 3 familles historiques restent filtrables.
  const visibleAlerts = useMemo<CockpitAlert[]>(
    () =>
      alerts.filter((a) => (alertPreferences as Record<string, boolean>)[a.event_type] !== false),
    [alerts, alertPreferences],
  );

  // Panneau : alertes H-1 (critiques) fusionnées aux alertes ride_events, triées
  // par priorité (critiques d'abord), plafonnées. Les H-1 ne sont pas filtrées
  // par préférences (alerte critique du §5.13).
  const panelAlerts = useMemo<CockpitAlert[]>(
    () => sortAlertsByPriority([...h1Alerts, ...visibleAlerts]).slice(0, MAX_PANEL_ALERTS),
    [h1Alerts, visibleAlerts],
  );

  const recentNoShow = useMemo<CockpitAlert | null>(() => {
    const cutoff = Date.now() - NOSHOW_DETECTION_WINDOW_MS;
    return (
      visibleAlerts.find((a) => {
        if (a.event_type !== 'patient_no_show') return false;
        if (dismissedNoShowIds.has(a.id)) return false;
        const ts = new Date(a.created_at).getTime();
        return !Number.isNaN(ts) && ts >= cutoff;
      }) ?? null
    );
  }, [visibleAlerts, dismissedNoShowIds]);

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
    <div className="space-y-16">
      {weatherAlert && (
        <div
          role="status"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-12 rounded-lg border px-16 py-12 text-sm font-semibold"
        >
          <CloudLightning className="h-16 w-16 shrink-0" aria-hidden />
          <span>
            Mode alerte météo actif — {weatherAlert.motif}
            {weatherAlert.zone ? ` (zone ${weatherAlert.zone})` : ''}.
          </span>
          <Link href="/meteo" className="ml-auto shrink-0 underline">
            Gérer
          </Link>
        </div>
      )}
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
                  <Link
                    href={`/cockpit/optimisation?date=${new Date().toISOString().slice(0, 10)}`}
                  >
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
        <aside className="lg:border-border flex w-full shrink-0 flex-col gap-24 lg:w-80 lg:border-l lg:pl-24">
          <div className="space-y-8">
            <UnassignedH1Indicator count={unassignedH1Count} />
            <AlertSoundToggle armed={sound.armed} onArm={sound.arm} onDisarm={sound.disarm} />
          </div>
          <AlertsPanel alerts={panelAlerts} />
          <DraftsIndicator />
          <ComplianceAlertsPanel alerts={complianceAlerts} variant="panel" limit={4} />
          <PrescriptionAlertsPanel alerts={prescriptionAlerts} />
        </aside>
        {recentNoShowRide && <NoShowAlertModal ride={recentNoShowRide} onClose={dismissNoShow} />}
      </div>
    </div>
  );
}
