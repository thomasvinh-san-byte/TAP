'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { reunionDayKey } from '@tap/shared';
import { cn } from '@/lib/utils';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { useCockpitRides } from '../../cockpit/_lib/use-cockpit-rides';
import { RealtimeStatusBadge } from '../../cockpit/_components/realtime-status-badge.client';
import { RideDrawer } from '../../courses/_components/ride-drawer.client';
import { MODE_LABEL } from '../../courses/_components/ride-badges';
import { unassignRideAction } from '../../courses/actions/assignment';
import { reassignRidesBatchAction } from '../../replanification/actions';
import type { PlanningDriverOption, PlanningRideMeta } from '../_lib/planning-queries';
import { statusBlockClass, statusLabel } from '../_lib/planning-status';
import { detectReassignConflict } from '../_lib/planning-conflicts';
import { computeTourneeIndicators } from '../_lib/tournee-indicators';
import { PlanningDayPicker } from './planning-day-picker.client';
import { PlanningGrid } from './planning-grid.client';
import { PlanningEmptyDay, PlanningNoMatch } from './planning-empty-state.client';
import { PlanningReassignDialog, type ReassignTarget } from './planning-reassign-dialog.client';
import {
  PlanningFilters,
  EMPTY_FILTERS,
  UNASSIGNED_FILTER,
  type PlanningFilterState,
} from './planning-filters.client';

interface Props {
  date: string;
  initialRides: CockpitRide[];
  meta: Record<string, PlanningRideMeta>;
  drivers: PlanningDriverOption[];
}

function patientName(ride: CockpitRide): string {
  const p = ride.patient;
  return p ? [p.nom, p.prenom].filter(Boolean).join(' ').toLowerCase() : '';
}

function patientLabel(ride: CockpitRide): string {
  const p = ride.patient;
  const label = p ? [p.nom, p.prenom].filter(Boolean).join(' ') : '';
  return label || 'Patient';
}

function uniqueOptions(pairs: [string, string][]): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const [value, label] of pairs) if (value) map.set(value, label);
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/**
 * Orchestrateur client du planning (Module 5.12 lots A + B). Réutilise le socle
 * Realtime du cockpit (`useCockpitRides`) : la grille reflète les changements en
 * direct. Filtres (chauffeur, véhicule, type, donneur, patient) en lecture. Un
 * clic ouvre le `RideDrawer`. Lot B : réaffectation par glisser-déposer OU par
 * la boîte accessible clavier (bouton du drawer) — UNITAIRE, jamais en lot ;
 * réutilise `reassignRidesBatchAction` (SMS + push best-effort, compare-and-set)
 * et `unassignRideAction` (dépose vers « Non affectées »). Une dépose en
 * chevauchement horaire probable passe par une confirmation (alerte, non
 * bloquante).
 */
export function PlanningContent({ date, initialRides, meta, drivers }: Props): JSX.Element {
  const router = useRouter();
  const { rides, status } = useCockpitRides(initialRides);
  const [openRideId, setOpenRideId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<PlanningFilterState>(EMPTY_FILTERS);
  const [reassignTarget, setReassignTarget] = React.useState<ReassignTarget | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Le socle Realtime écoute TOUTES les courses ; on borne au jour choisi.
  const dayRides = React.useMemo(
    () => rides.filter((r) => reunionDayKey(r.scheduled_at) === date),
    [rides, date],
  );

  // Indicateurs de tournée par chauffeur (lot C) — calculés sur TOUTES les
  // courses du jour (indépendant des filtres de lecture).
  const indicators = React.useMemo(
    () =>
      computeTourneeIndicators(
        dayRides.map((r) => ({
          driver_id: r.driver_id,
          status: r.status,
          scheduled_at: r.scheduled_at,
          ride_group_id: meta[r.id]?.ride_group_id ?? null,
        })),
      ),
    [dayRides, meta],
  );

  // Détection de conflit horaire probable pour une cible (lot B).
  const conflictFor = React.useCallback(
    (rideId: string, targetDriverId: string | null) =>
      detectReassignConflict(dayRides, rideId, targetDriverId),
    [dayRides],
  );

  // Exécute la réaffectation UNITAIRE. Cible nulle = désaffectation. Best-effort
  // SMS/push portés par les Server Actions ; Realtime reconcilie la grille.
  const executeReassign = React.useCallback(
    (rideId: string, targetDriverId: string | null): void => {
      startTransition(async () => {
        const res = targetDriverId
          ? await reassignRidesBatchAction([{ rideId, driverId: targetDriverId }])
          : await unassignRideAction(rideId);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success(targetDriverId ? 'Course réaffectée.' : 'Course désaffectée.');
        setReassignTarget(null);
        router.refresh();
      });
    },
    [router],
  );

  // Point d'entrée commun (dépose OU boîte). Une dépose en conflit ouvre la
  // confirmation ; sinon on exécute directement (chemin rapide).
  const requestReassign = React.useCallback(
    (rideId: string, targetDriverId: string | null): void => {
      const ride = dayRides.find((r) => r.id === rideId);
      if (!ride) return;
      if (targetDriverId === (ride.driver_id ?? null)) return; // no-op
      if (conflictFor(rideId, targetDriverId)) {
        setReassignTarget({
          rideId,
          patientLabel: patientLabel(ride),
          scheduledAt: ride.scheduled_at,
          currentDriverId: ride.driver_id ?? null,
          presetTarget: targetDriverId,
        });
        return;
      }
      executeReassign(rideId, targetDriverId);
    },
    [dayRides, conflictFor, executeReassign],
  );

  // Chemin clavier : le bouton du drawer ouvre la boîte, cible à choisir.
  const openReassignDialog = React.useCallback(
    (rideId: string): void => {
      const ride = dayRides.find((r) => r.id === rideId);
      if (!ride) return;
      setOpenRideId(null);
      setReassignTarget({
        rideId,
        patientLabel: patientLabel(ride),
        scheduledAt: ride.scheduled_at,
        currentDriverId: ride.driver_id ?? null,
      });
    },
    [dayRides],
  );

  // Options de filtre dérivées des courses du jour.
  const vehicleOptions = React.useMemo(
    () =>
      uniqueOptions(
        dayRides
          .filter((r) => r.vehicle_id)
          .map((r) => [r.vehicle_id as string, r.vehicle?.immatriculation ?? 'Véhicule']),
      ),
    [dayRides],
  );
  const typeOptions = React.useMemo(
    () =>
      uniqueOptions(
        dayRides.map((r) => {
          const mode = meta[r.id]?.transport_mode ?? '';
          return [mode, MODE_LABEL[mode] ?? mode];
        }),
      ),
    [dayRides, meta],
  );
  const donneurOptions = React.useMemo(
    () =>
      uniqueOptions(
        dayRides.map((r) => {
          const m = meta[r.id];
          return [m?.ordering_party_id ?? '', m?.ordering_party_label ?? "Donneur d'ordres"];
        }),
      ),
    [dayRides, meta],
  );

  const filtered = React.useMemo(() => {
    const q = filters.patient.trim().toLowerCase();
    return dayRides.filter((r) => {
      if (filters.driver === UNASSIGNED_FILTER && r.driver_id) return false;
      if (filters.driver && filters.driver !== UNASSIGNED_FILTER && r.driver_id !== filters.driver)
        return false;
      if (filters.vehicle && r.vehicle_id !== filters.vehicle) return false;
      if (filters.type && meta[r.id]?.transport_mode !== filters.type) return false;
      if (filters.donneur && meta[r.id]?.ordering_party_id !== filters.donneur) return false;
      if (q && !patientName(r).includes(q)) return false;
      return true;
    });
  }, [dayRides, filters, meta]);

  // Statuts présents (légende couleur + texte).
  const presentStatuses = React.useMemo(() => {
    const set = new Set(filtered.map((r) => r.status));
    return [...set];
  }, [filtered]);

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <PlanningDayPicker date={date} />
        <RealtimeStatusBadge status={status} />
      </div>

      <PlanningFilters
        filters={filters}
        onChange={setFilters}
        drivers={drivers}
        vehicles={vehicleOptions}
        types={typeOptions}
        donneurs={donneurOptions}
      />

      {presentStatuses.length > 0 ? (
        <ul
          className="flex flex-wrap items-center gap-x-16 gap-y-4"
          aria-label="Légende des statuts"
        >
          {presentStatuses.map((s) => (
            <li key={s} className="text-muted-foreground flex items-center gap-4 text-xs">
              <span
                aria-hidden
                className={cn('h-12 w-12 rounded-sm border-l-4', statusBlockClass(s))}
              />
              {statusLabel(s)}
            </li>
          ))}
        </ul>
      ) : null}

      {dayRides.length === 0 ? (
        <PlanningEmptyDay />
      ) : filtered.length === 0 ? (
        <PlanningNoMatch />
      ) : (
        <PlanningGrid
          rides={filtered}
          drivers={drivers}
          onSelect={(id) => setOpenRideId(id)}
          onDropRide={requestReassign}
          onReassignRide={openReassignDialog}
          indicators={indicators}
        />
      )}

      {/* Le bouton d'affectation du drawer ouvre la boîte de réaffectation
          (chemin accessible clavier, alternative au glisser-déposer). */}
      <RideDrawer
        rideId={openRideId}
        open={openRideId !== null}
        onOpenChange={(o) => !o && setOpenRideId(null)}
        onRequestAssign={openReassignDialog}
      />

      <PlanningReassignDialog
        target={reassignTarget}
        drivers={drivers}
        pending={pending}
        conflictFor={conflictFor}
        onConfirm={executeReassign}
        onClose={() => setReassignTarget(null)}
      />
    </div>
  );
}
