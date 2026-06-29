'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  INCIDENT_ESCALADE_SEUIL,
  INCIDENT_WINDOW_DAYS,
  PATIENT_INCIDENT_TYPES,
  PATIENT_INCIDENT_TYPE_LABELS,
  type IncidentTone,
  type PatientIncidentType,
} from '../_lib/incident-escalade';
import { PatientIncidentForm, type IncidentRideOption } from './patient-incident-form.client';

export interface PatientIncidentItem {
  id: string;
  type: PatientIncidentType;
  note: string | null;
  occurred_at: string;
  ride_id: string | null;
}

export interface PatientIncidentsRecapProps {
  incidents: PatientIncidentItem[];
  countsByType: Record<PatientIncidentType, number>;
  windowTotal: number;
  tone: IncidentTone;
}

const TONE_BANNER: Record<IncidentTone, string> = {
  neutre: 'border-border bg-muted/40 text-muted-foreground',
  attention: 'border-amber-300 bg-amber-50 text-amber-900',
  alerte: 'border-destructive/40 bg-destructive/10 text-destructive',
};

function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function PatientIncidentsSection({
  patientId,
  recap,
  rideOptions,
}: {
  patientId: string;
  recap: PatientIncidentsRecapProps;
  rideOptions: IncidentRideOption[];
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const rideLabels = React.useMemo(
    () => new Map(rideOptions.map((r) => [r.id, r.label])),
    [rideOptions],
  );

  return (
    <section className="space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Historique des incidents
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="gap-8"
        >
          <Plus className="h-12 w-12" aria-hidden />
          Signaler un incident
        </Button>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-8 rounded-md border p-12',
          TONE_BANNER[recap.tone],
        )}
      >
        {recap.tone === 'alerte' && <AlertTriangle className="h-16 w-16 shrink-0" aria-hidden />}
        <span className="text-sm font-medium tabular-nums">
          {recap.windowTotal} incident{recap.windowTotal > 1 ? 's' : ''} sur {INCIDENT_WINDOW_DAYS}{' '}
          jours
        </span>
        {recap.tone === 'alerte' && (
          <span className="text-sm">
            · seuil d&apos;escalade dirigeant atteint ({INCIDENT_ESCALADE_SEUIL})
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-8">
        {PATIENT_INCIDENT_TYPES.map((t) => (
          <Badge
            key={t}
            variant={recap.countsByType[t] > 0 ? 'outline' : 'secondary'}
            className="text-xs tabular-nums"
          >
            {PATIENT_INCIDENT_TYPE_LABELS[t]} : {recap.countsByType[t]}
          </Badge>
        ))}
      </div>

      {recap.incidents.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun incident enregistré.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {recap.incidents.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-12 p-12">
              <div className="min-w-0 space-y-4">
                <div className="text-sm font-medium">{PATIENT_INCIDENT_TYPE_LABELS[i.type]}</div>
                {i.note && <p className="text-muted-foreground text-xs">{i.note}</p>}
                {i.ride_id && (
                  <p className="text-muted-foreground text-xs">
                    Course : {rideLabels.get(i.ride_id) ?? 'liée'}
                  </p>
                )}
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatDateFr(i.occurred_at)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-[460px]">
          <PatientIncidentForm
            patientId={patientId}
            rideOptions={rideOptions}
            onDone={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
}
