'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, CloudLightning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn } from '@/lib/utils';
import { listDraftsAction } from '../../courses/actions';
import type { WeatherAlert } from '../../meteo/_lib/queries';
import { useCockpitAlerts } from '../_lib/use-cockpit-alerts';
import { useCockpitRides } from '../_lib/use-cockpit-rides';
import { useUnassignedH1 } from '../_lib/use-unassigned-h1';
import { useStalePositions } from '../_lib/use-stale-positions';
import { sortAlertsByPriority, alertSeverity } from '../_lib/alert-priority';
import { useAlertSound, useAlertSoundOnNew } from '@/lib/alert-sound/use-alert-sound';
import type { CockpitAlert, CockpitRide } from '../_lib/types';
import type { CockpitAlertPreferences } from '@/lib/notifications/preferences';
import { useDriverPositions, type DriverPosition } from '../_lib/use-driver-positions';
import type { ComplianceAlertEnriched } from '../../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { ComplianceAlertsPanel } from '../../../(admin)/admin/conformite/_components/compliance-alerts-panel.client';
import type { PrescriptionAlertEnriched } from '../_lib/get-prescription-alerts';
import { PrescriptionAlertsPanel } from './prescription-alerts-panel.client';
import { AlertsPanel } from './alerts-panel.client';
import { DriverLoadPanel } from './driver-load-panel.client';
import { UnassignedH1Indicator } from './unassigned-h1-indicator.client';
import { AlertSoundToggle } from './alert-sound-toggle.client';
import { DraftsIndicator } from './drafts-indicator.client';
import { CoursesTable } from './courses-table.client';
import { DriverPositionsPanel } from './driver-positions-panel.client';
import { NoShowAlertModal } from './no-show-alert-modal.client';
import { RealtimeStatusBadge } from './realtime-status-badge.client';
import { CockpitSummaryStrip, scrollToPanel } from './cockpit-summary-strip.client';
import { RideDrawer } from '../../courses/_components/ride-drawer.client';
import { AssignModal } from '../../courses/_components/assign-modal.client';

const NOSHOW_DETECTION_WINDOW_MS = 60_000;
const NOSHOW_DISMISSED_KEY = 'cockpit:noshow-dismissed';
const MAX_PANEL_ALERTS = 20;

// COCKPIT-05 : cible d'ancrage d'un indicateur de la bande de synthèse. Reçoit le
// focus programmatique (défilement + mise en évidence) sans altérer le panneau.
// `focus:` (et non `focus-visible:`) car le focus est déclenché par code.
const PANEL_ANCHOR_CLASS =
  'scroll-mt-24 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2';

/** Libellé d'onglet contexte : texte + pastille de compte (masquée si 0). */
function contextTabLabel(text: string, count: number): JSX.Element {
  return (
    <span className="inline-flex items-center gap-8">
      {text}
      {count > 0 && (
        <span className="bg-muted-foreground/15 text-foreground rounded-full px-8 py-2 text-xs font-medium tabular-nums">
          {count}
        </span>
      )}
    </span>
  );
}

export function CockpitContent({
  initialRides,
  initialAlerts,
  initialPositions,
  driverLabels,
  driverIdByProfileId,
  complianceAlerts,
  prescriptionAlerts,
  alertPreferences,
  weatherAlert,
}: {
  initialRides: CockpitRide[];
  initialAlerts: CockpitAlert[];
  initialPositions: DriverPosition[];
  driverLabels: Record<string, string>;
  driverIdByProfileId: Record<string, string>;
  complianceAlerts: ComplianceAlertEnriched[];
  prescriptionAlerts: PrescriptionAlertEnriched[];
  alertPreferences: CockpitAlertPreferences;
  weatherAlert: WeatherAlert | null;
}): JSX.Element {
  const { rides, status, newRideIds } = useCockpitRides(initialRides);
  const { alerts } = useCockpitAlerts(initialAlerts);
  // Repère discret « plan d'optimisation appliqué » : posé par la redirection
  // depuis l'écran d'optimisation (COCKPIT-09). Aucun chiffre inventé — la
  // preuve est visuelle (courses regroupées par tournée sur la carte).
  const optimiseApplied = useSearchParams().get('optimise') === 'applied';

  // R1 — zone tertiaire en onglets (contexte à un clic). Un seul panneau monté à
  // la fois ; les autres sont à un clic. Défaut : brouillons.
  const [contextTab, setContextTab] = useState<'brouillons' | 'conformite' | 'prescriptions'>(
    'brouillons',
  );
  // Compte des brouillons pour la pastille d'onglet — même cache que la bande de
  // synthèse et `DraftsIndicator` (lecture partagée, aucune requête dupliquée).
  const { data: draftsData } = useQuery({
    queryKey: ['ride-drafts'],
    queryFn: () => listDraftsAction(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
  const draftsCount = Array.isArray(draftsData) ? draftsData.length : 0;

  // COCKPIT-10 — détail course actionnable : un SEUL état de drawer au niveau du
  // cockpit, ouvert depuis la liste « Ma journée » ET depuis l'aperçu carte. On
  // réutilise `RideDrawer` (détail, timeline, chat, actions affecter/réaffecter/
  // désaffecter/annuler avec leurs garde-fous) et `AssignModal` — rien de recréé.
  // Le provider `RideExpressOrchestrator` est déjà monté au layout (app) : le
  // drawer fonctionne ici comme sur la page des courses. Le rafraîchissement du
  // cockpit passe par le realtime existant + la revalidation des Server Actions.
  const [openRideId, setOpenRideId] = useState<string | null>(null);
  const [assignRideId, setAssignRideId] = useState<string | null>(null);

  // Navigation depuis la bande de synthèse : les cibles tertiaires ouvrent d'abord
  // leur onglet, puis on défile (le panneau n'est monté qu'une fois l'onglet actif).
  const handleCounterNavigate = useCallback((targetId: string): void => {
    const tab =
      targetId === 'cockpit-panel-drafts'
        ? 'brouillons'
        : targetId === 'cockpit-panel-compliance'
          ? 'conformite'
          : null;
    if (tab) {
      setContextTab(tab);
      // Deux frames : laisser React monter le panneau de l'onglet avant de défiler.
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToPanel(targetId)));
    } else {
      scrollToPanel(targetId);
    }
  }, []);
  const [dismissedNoShowIds, setDismissedNoShowIds] = useState<Set<string>>(() => new Set());

  // COCKPIT-01 (§5.13) : courses validées non affectées à H-1 (calculées, ticker).
  const { count: unassignedH1Count, alerts: h1Alerts } = useUnassignedH1(rides);
  // COCKPIT-02 (§5.13) : positions périmées des chauffeurs en service. Positions
  // liftées ici (une seule subscription, partagée avec la carte).
  const { positionsByDriver } = useDriverPositions(initialPositions);
  const { alerts: staleAlerts } = useStalePositions(rides, positionsByDriver, driverLabels);
  // Son d'alerte réutilisable, armé par interaction (politique autoplay). Sonorise
  // les alertes critiques calculées (H-1 + géoloc périmée), une fois par transition.
  const sound = useAlertSound();
  useAlertSoundOnNew(
    useMemo(() => [...h1Alerts, ...staleAlerts].map((a) => a.id), [h1Alerts, staleAlerts]),
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
    () =>
      sortAlertsByPriority([...h1Alerts, ...staleAlerts, ...visibleAlerts]).slice(
        0,
        MAX_PANEL_ALERTS,
      ),
    [h1Alerts, staleAlerts, visibleAlerts],
  );

  // COCKPIT-05 : nombre d'alertes de sévérité critique, pour la bande de synthèse.
  // Réutilise l'ensemble déjà fusionné (H-1 + géoloc périmée + ride_events) et la
  // fonction pure `alertSeverity` — aucune nouvelle détection. Compte AVANT le
  // plafonnement d'affichage (`MAX_PANEL_ALERTS`) pour rester un total fidèle.
  const criticalAlertsCount = useMemo<number>(
    () =>
      [...h1Alerts, ...staleAlerts, ...visibleAlerts].filter(
        (a) => alertSeverity(a.event_type) === 'critique',
      ).length,
    [h1Alerts, staleAlerts, visibleAlerts],
  );
  // Positions périmées : réutilise le compte des alertes déjà détectées (COCKPIT-02).
  const stalePositionsCount = staleAlerts.length;

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
      {optimiseApplied && (
        <div
          role="status"
          className="border-accent/40 bg-accent/10 text-foreground flex items-center gap-12 rounded-lg border px-16 py-12 text-sm"
        >
          <Sparkles className="text-accent h-16 w-16 shrink-0" aria-hidden />
          <span>
            Optimisation appliquée. Les courses affectées apparaissent regroupées par tournée
            (couleur) sur la carte des chauffeurs ; les non affectées restent neutres.
          </span>
        </div>
      )}
      <CockpitSummaryStrip
        unassignedH1Count={unassignedH1Count}
        criticalAlertsCount={criticalAlertsCount}
        stalePositionsCount={stalePositionsCount}
        complianceCount={complianceAlerts.length}
        onNavigate={handleCounterNavigate}
      />
      {/* Layout BENTO — grille CSS 12 colonnes (2 dimensions), écart uniforme
          16px, hauteurs minimales par tuile pour éviter le « saut » au chargement.
          La taille encode l'importance : carte (span 6) + liste (span 3) primaires
          côte à côte ; colonne droite (span 3, deux lignes) = alertes critiques +
          charge ; contexte (span 9) en onglets sous la carte+liste. Ordre du DOM =
          ordre visuel (carte, liste, colonne droite, contexte) → tabulation et
          lecteurs d'écran suivent l'œil. Retombe en 2 colonnes (md) puis 1 (mobile),
          primaire d'abord. */}
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2 lg:grid-cols-12">
        {/* TUILE — Carte des chauffeurs (grande, primaire). Carte déjà « carte »
            (bordure/padding) : le conteneur ne double pas le chrome. */}
        <div
          id="cockpit-panel-positions"
          tabIndex={-1}
          className={cn(
            'flex min-h-0 flex-col md:col-span-2 md:min-h-[520px] lg:col-span-4',
            PANEL_ANCHOR_CLASS,
          )}
        >
          <DriverPositionsPanel
            positionsByDriver={positionsByDriver}
            driverLabels={driverLabels}
            rides={rides}
            driverIdByProfileId={driverIdByProfileId}
            onOpenRide={setOpenRideId}
          />
        </div>

        {/* TUILE — Ma journée (liste, primaire). En-tête + tableau à défilement
            interne ; « Optimiser » en tête du panneau courses. */}
        <section
          aria-labelledby="ma-journee-title"
          className="bg-background border-border flex min-h-0 min-w-0 flex-col rounded-lg border md:col-span-1 md:min-h-[520px] lg:col-span-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-8 p-16 pb-12">
            <div className="min-w-0">
              <h2 id="ma-journee-title" className="text-base font-semibold">
                Ma journée
              </h2>
              <p className="text-muted-foreground text-sm">
                {rides.length} course{rides.length > 1 ? 's' : ''} planifiée
                {rides.length > 1 ? 's' : ''} aujourd&apos;hui
              </p>
            </div>
            <div className="flex items-center gap-8">
              <Button
                asChild
                variant="accent"
                className="min-h-[44px]"
                data-testid="optimize-day-btn"
              >
                <Link href={`/cockpit/optimisation?date=${new Date().toISOString().slice(0, 10)}`}>
                  <Sparkles className="mr-8 h-16 w-16" aria-hidden />
                  Optimiser la journée
                </Link>
              </Button>
              <RealtimeStatusBadge status={status} />
            </div>
          </div>
          {/* Défilement vertical ET horizontal INTERNE : repli gracieux si la
              tuile reste plus étroite que la largeur minimale du tableau — les
              colonnes essentielles (chauffeur, statut) ne sont jamais coupées,
              elles défilent. `min-w` garde le tableau lisible plutôt qu'écrasé. */}
          <div className="border-border min-h-0 flex-1 overflow-auto border-t">
            <CoursesTable
              rides={rides}
              newRideIds={newRideIds}
              className="min-w-[600px] !rounded-none !border-0"
              onRowClick={(ride) => setOpenRideId(ride.id)}
            />
          </div>
        </section>

        {/* COLONNE DROITE (span 3, deux lignes) — alertes critiques (jamais
            enterrées) puis charge, météo, son. Contexte d'action / suivi, calme. */}
        <div className="flex flex-col gap-16 self-start md:col-span-1 lg:col-span-3 lg:row-span-2">
          {panelAlerts.length > 0 && (
            <div className="bg-background border-border rounded-lg border p-16">
              {unassignedH1Count > 0 && (
                <div
                  id="cockpit-panel-unassigned-h1"
                  tabIndex={-1}
                  className={cn('mb-12', PANEL_ANCHOR_CLASS)}
                >
                  <UnassignedH1Indicator count={unassignedH1Count} />
                </div>
              )}
              <div id="cockpit-panel-alerts" tabIndex={-1} className={PANEL_ANCHOR_CLASS}>
                <AlertsPanel alerts={panelAlerts} />
              </div>
            </div>
          )}
          <div className="bg-background border-border rounded-lg border p-16">
            <DriverLoadPanel rides={rides} driverLabels={driverLabels} />
          </div>
          {weatherAlert && (
            <div
              role="status"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-8 rounded-lg border px-12 py-8 text-sm"
            >
              <CloudLightning className="mt-2 h-16 w-16 shrink-0" aria-hidden />
              <span className="min-w-0">
                Mode alerte météo actif — {weatherAlert.motif}
                {weatherAlert.zone ? ` (zone ${weatherAlert.zone})` : ''}.{' '}
                <Link href="/meteo" className="underline">
                  Gérer
                </Link>
              </span>
            </div>
          )}
          <AlertSoundToggle armed={sound.armed} onArm={sound.arm} onDisarm={sound.disarm} />
        </div>

        {/* TUILE — Contexte (tertiaire) en onglets, à un clic. Un seul panneau
            monté ; pastille de compte par onglet. */}
        <section
          aria-label="Contexte"
          className="bg-background border-border flex flex-col gap-12 rounded-lg border p-16 md:col-span-2 lg:col-span-9"
        >
          <SegmentedControl
            options={[
              { value: 'brouillons', label: contextTabLabel('Brouillons', draftsCount) },
              {
                value: 'conformite',
                label: contextTabLabel('Conformité', complianceAlerts.length),
              },
              {
                value: 'prescriptions',
                label: contextTabLabel('Prescriptions', prescriptionAlerts.length),
              },
            ]}
            value={contextTab}
            onValueChange={setContextTab}
            ariaLabel="Contexte : brouillons, conformité, prescriptions"
          />
          <div role="tabpanel" aria-label={`Contexte : ${contextTab}`}>
            {contextTab === 'brouillons' && (
              <div id="cockpit-panel-drafts" tabIndex={-1} className={PANEL_ANCHOR_CLASS}>
                <DraftsIndicator />
              </div>
            )}
            {contextTab === 'conformite' && (
              <div id="cockpit-panel-compliance" tabIndex={-1} className={PANEL_ANCHOR_CLASS}>
                <ComplianceAlertsPanel alerts={complianceAlerts} variant="panel" limit={4} />
              </div>
            )}
            {contextTab === 'prescriptions' && (
              <div id="cockpit-panel-prescriptions" tabIndex={-1} className={PANEL_ANCHOR_CLASS}>
                <PrescriptionAlertsPanel alerts={prescriptionAlerts} />
              </div>
            )}
          </div>
        </section>
      </div>

      {recentNoShowRide && <NoShowAlertModal ride={recentNoShowRide} onClose={dismissNoShow} />}

      {/* Détail course actionnable — RideDrawer + AssignModal réutilisés (un seul
          état, ouvert depuis la liste ou la carte). Panneau latéral non bloquant :
          liste et carte restent visibles ; fermeture bouton / Échap / clic extérieur
          (gérée par Sheet). Les actions et leurs garde-fous sont ceux de l'existant. */}
      <RideDrawer
        rideId={openRideId}
        open={openRideId !== null}
        onOpenChange={(o) => !o && setOpenRideId(null)}
        onRequestAssign={(rid) => {
          setOpenRideId(null);
          setAssignRideId(rid);
        }}
      />
      <AssignModal
        rideId={assignRideId}
        open={assignRideId !== null}
        onOpenChange={(o) => !o && setAssignRideId(null)}
      />
    </div>
  );
}
