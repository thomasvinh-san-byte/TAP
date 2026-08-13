'use client';

import * as React from 'react';
import { reunionDayKey } from '@tap/shared';
import { cn } from '@/lib/utils';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { useCockpitRides } from '../../cockpit/_lib/use-cockpit-rides';
import { RealtimeStatusBadge } from '../../cockpit/_components/realtime-status-badge.client';
import { RideDrawer } from '../../courses/_components/ride-drawer.client';
import { MODE_LABEL } from '../../courses/_components/ride-badges';
import type { PlanningDriverOption, PlanningRideMeta } from '../_lib/planning-queries';
import { statusBlockClass, statusLabel } from '../_lib/planning-status';
import { PlanningDayPicker } from './planning-day-picker.client';
import { PlanningGrid } from './planning-grid.client';
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

function uniqueOptions(pairs: [string, string][]): { value: string; label: string }[] {
  const map = new Map<string, string>();
  for (const [value, label] of pairs) if (value) map.set(value, label);
  return [...map.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/**
 * Orchestrateur client du planning (Module 5.12 lot A) — LECTURE SEULE.
 * Réutilise le socle Realtime du cockpit (`useCockpitRides`) : la grille reflète
 * les changements en direct. Filtres (chauffeur, véhicule, type, donneur,
 * patient) appliqués en lecture. Un clic ouvre le `RideDrawer` en consultation
 * (aucune écriture ; l'affectation est le lot B).
 */
export function PlanningContent({ date, initialRides, meta, drivers }: Props): JSX.Element {
  const { rides, status } = useCockpitRides(initialRides);
  const [openRideId, setOpenRideId] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<PlanningFilterState>(EMPTY_FILTERS);

  // Le socle Realtime écoute TOUTES les courses ; on borne au jour choisi.
  const dayRides = React.useMemo(
    () => rides.filter((r) => reunionDayKey(r.scheduled_at) === date),
    [rides, date],
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

      <PlanningGrid rides={filtered} drivers={drivers} onSelect={(id) => setOpenRideId(id)} />

      {/* Lecture seule : le drawer s'ouvre en consultation. `onRequestAssign`
          est neutralisé à ce lot (l'affectation est le lot B). */}
      <RideDrawer
        rideId={openRideId}
        open={openRideId !== null}
        onOpenChange={(o) => !o && setOpenRideId(null)}
        onRequestAssign={() => {}}
      />
    </div>
  );
}
