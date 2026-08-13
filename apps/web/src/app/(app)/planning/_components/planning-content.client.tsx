'use client';

import * as React from 'react';
import { reunionDayKey } from '@tap/shared';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { useCockpitRides } from '../../cockpit/_lib/use-cockpit-rides';
import { RealtimeStatusBadge } from '../../cockpit/_components/realtime-status-badge.client';
import { RideDrawer } from '../../courses/_components/ride-drawer.client';
import type { PlanningDriverOption, PlanningRideMeta } from '../_lib/planning-queries';
import { PlanningDayPicker } from './planning-day-picker.client';
import { PlanningGrid } from './planning-grid.client';

interface Props {
  date: string;
  initialRides: CockpitRide[];
  meta: Record<string, PlanningRideMeta>;
  drivers: PlanningDriverOption[];
}

/**
 * Orchestrateur client du planning (Module 5.12 lot A) — LECTURE SEULE.
 * Réutilise le socle Realtime du cockpit (`useCockpitRides`) : la grille reflète
 * les changements de courses en direct. Un clic sur une course ouvre le
 * `RideDrawer` existant en consultation (aucune écriture ; l'affectation est le
 * lot B). Les courses sont bornées au jour sélectionné (fuseau Réunion).
 */
export function PlanningContent({ date, initialRides, drivers }: Props): JSX.Element {
  const { rides, status } = useCockpitRides(initialRides);
  const [openRideId, setOpenRideId] = React.useState<string | null>(null);

  // Le socle Realtime écoute TOUTES les courses ; on borne l'affichage au jour
  // choisi (une course déplacée hors du jour disparaît, une course entrante du
  // jour apparaît).
  const dayRides = React.useMemo(
    () => rides.filter((r) => reunionDayKey(r.scheduled_at) === date),
    [rides, date],
  );

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <PlanningDayPicker date={date} />
        <RealtimeStatusBadge status={status} />
      </div>

      <PlanningGrid rides={dayRides} drivers={drivers} onSelect={(id) => setOpenRideId(id)} />

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
