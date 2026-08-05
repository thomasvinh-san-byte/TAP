'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, RequiredFieldsLegend } from '@/components/form/field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cancelRidesBatchWeatherAction } from '../actions';

/**
 * Annulation en masse des courses d'une journée pour alerte météo (DEC-170).
 * Action destructive (statut `annulee_meteo`, SMS patients) → confirmation
 * modale obligatoire (CLAUDE.md §5). Filtre zone optionnel (ville de prise en
 * charge). La saisie est désactivée tant que le mode météo n'est pas actif.
 */
export function WeatherCancelForm({ enabled }: { enabled: boolean }): JSX.Element {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = React.useState(today);
  const [zone, setZone] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirm(): void {
    startTransition(async () => {
      const res = await cancelRidesBatchWeatherAction({
        date,
        zone: zone.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.cancelled} course(s) annulée(s). Patients et chauffeurs prévenus.`);
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="border-border bg-card space-y-16 rounded-lg border p-16">
      <RequiredFieldsLegend />
      <Field
        id="meteo-date"
        label="Journée à annuler"
        required
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={!enabled}
      />
      <Field
        id="meteo-cancel-zone"
        label="Zone"
        value={zone}
        onChange={(e) => setZone(e.target.value)}
        maxLength={120}
        placeholder="Ex. Le Tampon — laisser vide pour toutes les zones"
        hint="Laisser vide pour toutes les zones."
        disabled={!enabled}
      />
      <Button
        type="button"
        variant="destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={!enabled || pending}
      >
        <CalendarX className="mr-8 h-16 w-16" aria-hidden />
        Annuler les courses du jour
      </Button>
      {!enabled && (
        <p className="text-muted-foreground text-sm">
          Activez d&apos;abord le mode alerte météo pour annuler des courses en masse.
        </p>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!pending) setConfirmOpen(o);
        }}
      >
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Annuler les courses du {date} ?</DialogTitle>
            <DialogDescription>
              Toutes les courses non démarrées de cette journée
              {zone.trim() ? ` dans la zone « ${zone.trim()} »` : ''} passeront au statut « annulée
              météo ». Les patients consentants et les chauffeurs concernés seront prévenus. Action
              irréversible en masse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-12">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? 'Annulation…' : 'Confirmer l’annulation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
