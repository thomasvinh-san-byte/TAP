'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, UserX, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { reassignRidesBatchAction, resolveIncidentAction } from '../actions';
import type { IncidentRideView, IncidentWithProposals } from '../_lib/queries';

const MODE_LABELS: Record<string, string> = {
  taxi_conventionne: 'Taxi',
  vsl: 'VSL',
  tpmr: 'TPMR',
  ambulance: 'Ambulance',
};

function candidateLabel(c: IncidentRideView['proposal']['candidates'][number]): string {
  const dist = c.distanceKm !== null ? `${Math.round(c.distanceKm)} km` : 'dist. inconnue';
  return `${c.driverLabel} — ${dist} · ${c.load} course${c.load > 1 ? 's' : ''}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IncidentCard({ incident }: { incident: IncidentWithProposals }): JSX.Element {
  const router = useRouter();
  const [selection, setSelection] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const r of incident.rides) {
      if (r.proposal.best) init[r.rideId] = r.proposal.best.driverId;
    }
    return init;
  });
  const [pending, startTransition] = React.useTransition();

  function reassignAll(): void {
    const items = incident.rides
      .filter((r) => selection[r.rideId])
      .map((r) => ({ rideId: r.rideId, driverId: selection[r.rideId]! }));
    if (items.length === 0) {
      toast.error('Aucune course à réaffecter.');
      return;
    }
    startTransition(async () => {
      const res = await reassignRidesBatchAction(items);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.reassigned} course(s) réaffectée(s).`);
      router.refresh();
    });
  }

  function resolve(): void {
    startTransition(async () => {
      const res = await resolveIncidentAction(incident.incidentId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Incident clôturé.');
      router.refresh();
    });
  }

  const Icon = incident.type === 'panne_vehicule' ? Wrench : UserX;
  const typeLabel = incident.type === 'panne_vehicule' ? 'Panne véhicule' : 'Indisponible';

  return (
    <section className="border-border rounded-md border">
      <header className="border-border flex flex-wrap items-center justify-between gap-12 border-b p-16">
        <div className="flex items-center gap-12">
          <div className="bg-destructive/10 text-destructive flex h-32 w-32 shrink-0 items-center justify-center rounded-md">
            <Icon className="h-16 w-16" aria-hidden />
          </div>
          <div>
            <div className="font-medium">{incident.driverLabel}</div>
            <div className="text-muted-foreground text-xs">
              {typeLabel} · depuis {fmtDateTime(incident.startedAt)}
              {incident.lieu ? ` · ${incident.lieu}` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <Button type="button" variant="outline" size="sm" onClick={resolve} disabled={pending}>
            Marquer résolu
          </Button>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={reassignAll}
            disabled={pending}
            className="gap-8"
          >
            <Check className="h-12 w-12" aria-hidden />
            Réaffecter les courses
          </Button>
        </div>
      </header>

      {incident.nature && (
        <p className="text-muted-foreground border-border border-b px-16 py-8 text-sm">
          {incident.nature}
        </p>
      )}

      {incident.rides.length === 0 ? (
        <p className="text-muted-foreground p-16 text-sm">
          Aucune course restante à réaffecter pour ce chauffeur.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {incident.rides.map((r) => (
            <RideRow
              key={r.rideId}
              ride={r}
              value={selection[r.rideId] ?? ''}
              onChange={(v) => setSelection((prev) => ({ ...prev, [r.rideId]: v }))}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RideRow({
  ride,
  value,
  onChange,
}: {
  ride: IncidentRideView;
  value: string;
  onChange: (v: string) => void;
}): JSX.Element {
  return (
    <li className="flex flex-wrap items-center justify-between gap-12 p-16">
      <div className="min-w-0">
        <div className="truncate font-medium">{ride.patientLabel || 'Course'}</div>
        <div className="text-muted-foreground truncate text-xs">
          {fmtDateTime(ride.scheduledAt)} · {MODE_LABELS[ride.transportMode] ?? ride.transportMode}{' '}
          · {ride.pickupAddress}
        </div>
      </div>
      <div className="w-full sm:w-[320px]">
        {ride.proposal.reassignable ? (
          <Select
            ariaLabel={`Chauffeur de remplacement pour ${ride.patientLabel}`}
            value={value}
            onChange={onChange}
            items={ride.proposal.candidates.map((c) => ({
              value: c.driverId,
              label: candidateLabel(c),
            }))}
            triggerClassName="w-full"
          />
        ) : (
          <Badge variant="destructive" className="text-xs">
            Non réaffectable — aucun chauffeur compatible disponible
          </Badge>
        )}
      </div>
    </li>
  );
}
