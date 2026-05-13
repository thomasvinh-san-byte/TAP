'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import {
  listRidesEnrichedAction,
} from '../actions';
import type {
  RideRowEnriched,
  RideStatus,
  RideTransportMode,
} from '../_lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import {
  formatShortDateFr,
  formatTimeFr,
  isToday,
} from '@/lib/dates-fr';
import {
  ModeBadge,
  PaymentBadge,
  StatusBadge,
  UrgencyBadge,
} from './ride-badges';
import { RideDrawer } from './ride-drawer.client';
import { AssignModal } from './assign-modal.client';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'validee', label: 'Validées' },
  { value: 'assignee', label: 'Affectées' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
  { value: 'annulee_regulateur', label: 'Annulées' },
] as const;

const MODE_FILTERS = [
  { value: 'all', label: 'Tous modes' },
  { value: 'taxi_conventionne', label: 'Taxi conventionné' },
  { value: 'tpmr', label: 'TPMR' },
  { value: 'vsl', label: 'VSL' },
  { value: 'ambulance', label: 'Ambulance' },
] as const;

function truncate(s: string, max = 60): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * RidesList enrichi (Phase 3 / 03-D).
 *
 * Pré-fetch RSC via /courses/page.tsx (clé identique, queryFn pointe sur la
 * version enrichie). Click ligne → ouvre RideDrawer. Bouton "Assigner" sur
 * une ligne non assignée court-circuite le drawer pour passer direct à la
 * modal (gain de clic régulatrice 8h/jour).
 */
export function RidesList(): JSX.Element {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [openRideId, setOpenRideId] = useState<string | null>(null);
  const [assignRideId, setAssignRideId] = useState<string | null>(null);
  const dq = useDeferredValue(q);

  const { data, isPending } = useQuery({
    queryKey: ['rides', { status: statusFilter, mode: modeFilter }],
    queryFn: () =>
      listRidesEnrichedAction({
        status:
          statusFilter === 'all' ? undefined : (statusFilter as RideStatus),
        transport_mode:
          modeFilter === 'all'
            ? undefined
            : (modeFilter as RideTransportMode),
      }),
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  const rides = (data ?? []) as RideRowEnriched[];
  const filtered = rides.filter((r) => {
    if (!dq) return true;
    const lower = dq.toLowerCase();
    return (
      r.pickup_address.toLowerCase().includes(lower) ||
      r.dropoff_address.toLowerCase().includes(lower) ||
      `${r.patient?.nom ?? ''} ${r.patient?.prenom ?? ''}`
        .toLowerCase()
        .includes(lower)
    );
  });

  return (
    <div className="space-y-16">
      <div className="flex flex-wrap gap-12 items-end">
        <div className="flex-1 min-w-[240px]">
          <Input
            aria-label="Rechercher dans les adresses ou patients"
            placeholder="Rechercher…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          ariaLabel="Filtre statut"
          value={statusFilter}
          onChange={setStatusFilter}
          items={[...STATUS_FILTERS]}
          triggerClassName="min-w-[180px]"
        />
        <Select
          ariaLabel="Filtre mode de transport"
          value={modeFilter}
          onChange={setModeFilter}
          items={[...MODE_FILTERS]}
          triggerClassName="min-w-[180px]"
        />
      </div>

      {isPending && (
        <div className="space-y-8" aria-label="Chargement des courses">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </div>
      )}

      {!isPending && filtered.length === 0 && (
        <div className="rounded-md border border-border p-32 text-center text-sm text-muted-foreground">
          Aucune course ne correspond aux critères.
        </div>
      )}

      {!isPending && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm" aria-label="Liste des courses">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-12 py-12 font-medium">Heure</th>
                <th className="px-12 py-12 font-medium">Patient</th>
                <th className="px-12 py-12 font-medium">Trajet</th>
                <th className="px-12 py-12 font-medium">Mode</th>
                <th className="px-12 py-12 font-medium">Urgence</th>
                <th className="px-12 py-12 font-medium">Chauffeur</th>
                <th className="px-12 py-12 font-medium">Statut</th>
                <th className="px-12 py-12 font-medium">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <RideRowView
                  key={r.id}
                  ride={r}
                  onOpen={() => setOpenRideId(r.id)}
                  onAssign={() => setAssignRideId(r.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

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

interface RideRowProps {
  ride: RideRowEnriched;
  onOpen: () => void;
  onAssign: () => void;
}

function RideRowView({ ride, onOpen, onAssign }: RideRowProps): JSX.Element {
  const today = isToday(ride.scheduled_at);
  const patientName = ride.patient
    ? `${ride.patient.nom} ${ride.patient.prenom}`.trim()
    : 'Patient inconnu';
  return (
    <tr
      className="border-t border-border transition-colors duration-150 hover:bg-muted/50 cursor-pointer"
      onClick={onOpen}
    >
      <td className="px-12 py-12 align-top tabular-nums">
        <div className="font-medium">{formatTimeFr(ride.scheduled_at)}</div>
        {!today && (
          <div className="text-xs text-muted-foreground">
            {formatShortDateFr(ride.scheduled_at)}
          </div>
        )}
      </td>
      <td className="px-12 py-12 align-top">
        <div className="flex items-center gap-8">
          <InitialsAvatar name={patientName} size={24} />
          <span className="truncate max-w-[180px]">{patientName}</span>
        </div>
      </td>
      <td className="px-12 py-12 align-top">
        <div className="flex items-center gap-8 text-sm">
          <span className="truncate max-w-[220px]">
            {truncate(ride.pickup_address)}
          </span>
          <ArrowRight
            className="h-12 w-12 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate max-w-[220px]">
            {truncate(ride.dropoff_address)}
          </span>
        </div>
      </td>
      <td className="px-12 py-12 align-top">
        <ModeBadge mode={ride.transport_mode} />
      </td>
      <td className="px-12 py-12 align-top">
        <UrgencyBadge urgency={ride.urgency} />
      </td>
      <td className="px-12 py-12 align-top">
        {ride.driver ? (
          <div className="flex items-center gap-8">
            <InitialsAvatar
              name={ride.driver.nom_affichage}
              role="chauffeur"
              size={24}
            />
            <span className="truncate max-w-[140px]">
              {ride.driver.nom_affichage}
            </span>
          </div>
        ) : ride.status === 'validee' ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
          >
            Assigner
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-12 py-12 align-top">
        <StatusBadge status={ride.status} />
      </td>
      <td className="px-12 py-12 align-top">
        <PaymentBadge
          status={ride.payment_status}
          amountEur={ride.tarif_amount_eur}
        />
      </td>
    </tr>
  );
}
