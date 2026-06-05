'use client';

import { useState, useTransition } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cancelRecurrenceAction } from '../../actions/recurrences';
import type { RideRecurrence } from '@/types/recurrence';
import { RecurrenceCreateModal } from './recurrence-create-modal.client';
import { RecurrenceEditModal } from './recurrence-edit-modal.client';

const DAY_FR: Record<string, string> = {
  MO: 'Lun',
  TU: 'Mar',
  WE: 'Mer',
  TH: 'Jeu',
  FR: 'Ven',
  SA: 'Sam',
  SU: 'Dim',
};

const MODE_LABEL: Record<RideRecurrence['transport_mode'], string> = {
  vsl: 'VSL',
  taxi_conventionne: 'Taxi conventionné',
  tpmr: 'TPMR',
};

function humanizeRrule(rrule: string): string {
  const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
  const byhourMatch = rrule.match(/BYHOUR=(\d+)/);
  const byminuteMatch = rrule.match(/BYMINUTE=(\d+)/);
  const captured = bydayMatch?.[1];
  const daysFr = captured ? captured.split(',').map((d) => DAY_FR[d] ?? d) : [];
  const hh = (byhourMatch?.[1] ?? '08').padStart(2, '0');
  const mm = (byminuteMatch?.[1] ?? '00').padStart(2, '0');
  return `${daysFr.join('/')} ${hh}h${mm}`;
}

function formatDateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function RecurrencesSection({
  patientId,
  recurrences,
  futureCounts,
}: {
  patientId: string;
  recurrences: RideRecurrence[];
  futureCounts: Record<string, number>;
}): JSX.Element {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RideRecurrence | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleArchive(recurrence: RideRecurrence): void {
    if (
      !window.confirm('Archiver cette récurrence ? Les courses déjà générées seront préservées.')
    ) {
      return;
    }
    setArchiveError(null);
    setPendingId(recurrence.id);
    startTransition(async () => {
      const result = await cancelRecurrenceAction(recurrence.id);
      setPendingId(null);
      if (result.error) {
        setArchiveError(result.error);
      }
    });
  }

  return (
    <section className="space-y-12">
      <header className="flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Récurrences
        </h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden className="mr-8 h-16 w-16" />
          Nouvelle récurrence
        </Button>
      </header>

      {archiveError && (
        <p role="alert" className="text-destructive text-sm">
          {archiveError}
        </p>
      )}

      {recurrences.length === 0 ? (
        <div className="border-border bg-muted/20 flex flex-col items-center rounded-lg border border-dashed px-24 py-32 text-center">
          <Calendar aria-hidden className="text-muted-foreground/60 h-32 w-32" />
          <p className="text-foreground mt-12 text-sm font-medium">Aucune récurrence active</p>
          <p className="text-muted-foreground mt-4 text-xs">
            Crée une série de courses récurrentes pour ce patient (dialyse, chimiothérapie…).
          </p>
        </div>
      ) : (
        <ul className="space-y-8">
          {recurrences.map((rec) => {
            const futureCount = futureCounts[rec.id] ?? 0;
            const isPending = pendingId === rec.id;
            return (
              <li key={rec.id} className="border-border bg-background rounded-md border p-12">
                <div className="flex items-center justify-between gap-16">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-medium">{humanizeRrule(rec.rrule_str)}</p>
                    <p className="text-muted-foreground text-xs">
                      Depuis le {formatDateFr(rec.start_date)}
                      {rec.end_date ? ` jusqu'au ${formatDateFr(rec.end_date)}` : ''}
                      {' · '}
                      {MODE_LABEL[rec.transport_mode]}
                      {rec.urgency === 'prioritaire' ? ' · prioritaire' : ''}
                    </p>
                    <p className="text-muted-foreground mt-4 truncate text-xs">
                      {rec.pickup_address} → {rec.dropoff_address}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-8">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(rec)}
                      disabled={isPending}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchive(rec)}
                      disabled={isPending}
                    >
                      {isPending ? 'Archivage…' : 'Archiver'}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <RecurrenceCreateModal open={createOpen} onOpenChange={setCreateOpen} patientId={patientId} />

      {editing && (
        <RecurrenceEditModal
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          recurrence={editing}
          futureCount={futureCounts[editing.id] ?? 0}
        />
      )}
    </section>
  );
}
