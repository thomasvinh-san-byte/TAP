'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { cancelRideAction } from '../actions';

interface Props {
  rideId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCancelled?: () => void;
}

/**
 * Modal de confirmation d'annulation d'une course (clôture-bis Passe 1).
 *
 * Layout responsive miroir de EndRideModal (03-E) :
 *   - bottom-sheet sur mobile (inset-x-0 bottom-0)
 *   - centré sur ≥ sm
 * Motif libre optionnel (≤ 500 chars). Au succès, ferme le modal,
 * notifie le parent (`onCancelled`) qui peut fermer le drawer.
 */
export function CancelRideModal({ rideId, open, onOpenChange, onCancelled }: Props): JSX.Element {
  const [motif, setMotif] = React.useState('');
  const [isPending, startTransition] = useTransition();

  React.useEffect(() => {
    if (open) setMotif('');
  }, [open]);

  const submit = () => {
    startTransition(async () => {
      const res = await cancelRideAction({
        rideId,
        motif: motif.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Course annulée.');
      onOpenChange(false);
      onCancelled?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'fixed inset-x-0 bottom-0 left-0 right-0 top-auto w-full max-w-none',
          'translate-x-0 translate-y-0 rounded-b-none rounded-t-xl border-x-0 border-b-0',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-w-md',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
          'max-h-[92vh] gap-16 overflow-y-auto p-24',
        )}
      >
        <div className="space-y-8">
          <DialogTitle className="text-lg">Annuler cette course ?</DialogTitle>
          <DialogDescription className="text-sm">
            Cette action est irréversible. Un motif optionnel aide à retracer la décision.
          </DialogDescription>
        </div>

        <div className="space-y-8">
          <Label htmlFor="cancel-motif">Motif (optionnel)</Label>
          <Textarea
            id="cancel-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={500}
            placeholder="ex : patient indisponible, doublon CGSS…"
            autoFocus
          />
          <p className="text-muted-foreground text-xs tabular-nums">{motif.length} / 500</p>
        </div>

        <DialogFooter className="flex flex-row gap-12 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Conserver la course
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={isPending}>
            {isPending ? 'Annulation…' : 'Annuler la course'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
