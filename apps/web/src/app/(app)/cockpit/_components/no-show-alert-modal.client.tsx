'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cancelRideForNoShowAction, rescheduleRideAction } from '../actions';
import type { CockpitRide } from '../_lib/types';

/**
 * Alerte cockpit patient absent — slide-in droite, NON-BLOQUANT.
 *
 * Le cockpit reste interactif derrière (pas de Dialog full-screen modal).
 * Position fixed right-0 + animation CSS keyframes natifs (NFR-004).
 *
 * 2 CTA : Reprogrammer (variant default) OU Annuler la course (destructive).
 * Checkbox "Notifier la famille par SMS" GRISÉ tooltip DEC-055 Phase 06.
 *
 * Pas d'auto-close : la régulatrice décide explicitement (close manuel
 * possible via bouton X si elle souhaite traiter plus tard).
 */
function formatRideContext(ride: CockpitRide): string {
  const prenom = ride.patient?.prenom ?? '';
  const nom = ride.patient?.nom ?? '';
  const name = [prenom, nom].filter(Boolean).join(' ') || 'Patient inconnu';
  const t = new Date(ride.scheduled_at);
  const heure = Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Indian/Reunion',
      });
  return `${name} · ${heure}`;
}

export function NoShowAlertModal({
  ride,
  onClose,
}: {
  ride: CockpitRide;
  onClose: () => void;
}): JSX.Element {
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleReschedule(): void {
    setError(null);
    if (!rescheduleAt) {
      setError('Choisissez une nouvelle date/heure.');
      return;
    }
    const formData = new FormData();
    formData.set('ride_id', ride.id);
    formData.set('new_scheduled_at', new Date(rescheduleAt).toISOString());
    startTransition(async () => {
      const result = await rescheduleRideAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  function handleCancel(): void {
    setError(null);
    if (!window.confirm("Annuler définitivement cette course pour cause d'absence ?")) {
      return;
    }
    startTransition(async () => {
      const result = await cancelRideForNoShowAction(ride.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <aside
      role="alertdialog"
      aria-label="Patient absent : décision"
      className="cockpit-noshow-slide-in border-destructive/30 bg-background fixed right-0 top-0 z-40 flex h-full w-full max-w-[24rem] flex-col gap-12 border-l p-16 shadow-xl"
    >
      <header className="flex items-start justify-between gap-12">
        <div className="flex items-start gap-8">
          <AlertTriangle aria-hidden className="text-destructive h-20 w-20 shrink-0" />
          <div>
            <h2 className="text-foreground text-base font-semibold">Patient absent</h2>
            <p className="text-muted-foreground text-xs">{formatRideContext(ride)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="text-muted-foreground hover:bg-muted rounded-md p-4"
        >
          <X aria-hidden className="h-16 w-16" />
        </button>
      </header>

      <section className="space-y-8">
        <p className="text-foreground text-sm">Que souhaitez-vous faire pour cette course ?</p>

        <div className="space-y-4">
          <Label htmlFor="reschedule-at">Reprogrammer à</Label>
          <Input
            id="reschedule-at"
            type="datetime-local"
            value={rescheduleAt}
            onChange={(e) => setRescheduleAt(e.target.value)}
          />
        </div>

        <Button
          type="button"
          onClick={handleReschedule}
          disabled={pending || !rescheduleAt}
          className="w-full"
        >
          {pending ? 'Reprogrammation…' : 'Reprogrammer la course'}
        </Button>

        <Button
          type="button"
          variant="destructive"
          onClick={handleCancel}
          disabled={pending}
          className="w-full"
        >
          Annuler la course
        </Button>
      </section>

      <label
        className="text-muted-foreground flex cursor-not-allowed items-center gap-8 text-xs opacity-60"
        title="Disponible Phase 06 (DEC-055 : consentement tiers RGPD à clarifier)."
      >
        <input type="checkbox" disabled />
        Notifier la famille par SMS
      </label>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </aside>
  );
}
