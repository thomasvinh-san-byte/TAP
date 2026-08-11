'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { recordCgssEventAction } from '../actions-cgss-suivi';
import {
  CGSS_EVENT_LABEL,
  CGSS_MOTIF_FAMILLE_LABEL,
  CGSS_MOTIF_FAMILLES,
  CGSS_STATUS_LABEL,
  allowedEventsFor,
  isRejectEvent,
  type CgssEventType,
  type CgssMotifFamille,
  type CgssStatus,
} from '../_lib/cgss-invoice-status';
import type { CgssEventRow } from '../_lib/queries-cgss-suivi';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR');
}

/**
 * Saisie guidée d'un retour CGSS (périmètre A, déclaratif) + historique.
 * Ne propose que les transitions cohérentes avec le statut courant ; motif +
 * famille exigés pour un rejet (contraintes Lot 1). Aucun montant (D-09).
 */
export function CgssRecordEvent({
  rideId,
  patientLabel,
  status,
  events,
}: {
  rideId: string;
  patientLabel: string;
  status: CgssStatus;
  events: CgssEventRow[];
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const allowed = allowedEventsFor(status);
  const [eventType, setEventType] = React.useState<CgssEventType | ''>(allowed[0] ?? '');
  const [eventDate, setEventDate] = React.useState(todayIso());
  const [motif, setMotif] = React.useState('');
  const [motifFamille, setMotifFamille] = React.useState<CgssMotifFamille | ''>('');

  const rejet = eventType !== '' && isRejectEvent(eventType);

  function handleOpenChange(next: boolean): void {
    if (next) {
      // Réinitialise le formulaire à l'ouverture (le statut a pu changer depuis).
      setEventType(allowed[0] ?? '');
      setEventDate(todayIso());
      setMotif('');
      setMotifFamille('');
      setError(null);
    }
    setOpen(next);
  }

  function submit(): void {
    setError(null);
    if (eventType === '') return;
    startTransition(async () => {
      const res = await recordCgssEventAction({
        rideId,
        eventType,
        eventDate,
        motif: rejet ? motif.trim() : undefined,
        motifFamille: rejet && motifFamille !== '' ? motifFamille : undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setMotif('');
      setMotifFamille('');
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Enregistrer un retour
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Retour CGSS — {patientLabel}</DialogTitle>
          <DialogDescription>
            Statut actuel : {CGSS_STATUS_LABEL[status]}. Suivi déclaratif (saisie manuelle des
            retours).
          </DialogDescription>
        </DialogHeader>

        {events.length > 0 && (
          <div className="border-border max-h-[140px] space-y-4 overflow-y-auto rounded-md border p-8">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Historique
            </p>
            <ul className="space-y-2 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex items-baseline justify-between gap-8">
                  <span>{CGSS_EVENT_LABEL[e.event_type]}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatDate(e.event_date)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {allowed.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Cycle terminé ({CGSS_STATUS_LABEL[status]}) — aucun retour à enregistrer.
          </p>
        ) : (
          <div className="space-y-12">
            <div className="space-y-4">
              <Label htmlFor="cgss-event-type">Type de retour</Label>
              <Select
                value={eventType}
                onChange={(v) => setEventType(v as CgssEventType)}
                items={allowed.map((e) => ({ value: e, label: CGSS_EVENT_LABEL[e] }))}
                ariaLabel="Type de retour"
                triggerClassName="w-full"
              />
            </div>
            <div className="space-y-4">
              <Label htmlFor="cgss-event-date">Date du retour</Label>
              <Input
                id="cgss-event-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            {rejet && (
              <>
                <div className="space-y-4">
                  <Label htmlFor="cgss-motif">Motif du rejet</Label>
                  <Input
                    id="cgss-motif"
                    type="text"
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                    placeholder="Motif communiqué par la caisse"
                    maxLength={500}
                  />
                </div>
                <div className="space-y-4">
                  <Label htmlFor="cgss-famille">Famille de rejet</Label>
                  <Select
                    value={motifFamille}
                    onChange={(v) => setMotifFamille(v as CgssMotifFamille)}
                    items={CGSS_MOTIF_FAMILLES.map((f) => ({
                      value: f,
                      label: CGSS_MOTIF_FAMILLE_LABEL[f],
                    }))}
                    ariaLabel="Famille de rejet"
                    placeholder="Choisir une famille"
                    triggerClassName="w-full"
                  />
                </div>
              </>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}

        {allowed.length > 0 && (
          <DialogFooter>
            <Button
              type="button"
              variant="accent"
              onClick={submit}
              disabled={pending || eventType === '' || (rejet && motif.trim() === '')}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
