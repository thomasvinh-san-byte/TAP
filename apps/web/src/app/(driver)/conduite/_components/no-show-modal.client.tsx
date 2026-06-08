'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { enqueue } from '@/lib/offline/sync-engine';

const MAX_MOTIF = 200;

export function NoShowModal({
  rideId,
  open,
  onOpenChange,
}: {
  rideId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  const router = useRouter();
  const [motif, setMotif] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset(): void {
    setMotif('');
    setError(null);
  }

  function close(): void {
    if (pending) return;
    reset();
    onOpenChange(false);
  }

  function handleConfirm(): void {
    setError(null);
    const idempotency_key = crypto.randomUUID();
    const payload = { idempotency_key, motif: motif.trim() || undefined };

    startTransition(async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('offline');
        }
        const res = await fetch(`/api/driver/rides/${rideId}/no-show`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const msg = data.error ?? `HTTP ${res.status}`;
          if (res.status >= 400 && res.status < 500) {
            setError(msg);
            return;
          }
          throw new Error(msg);
        }
        toast.success('Absence patient déclarée.');
        reset();
        onOpenChange(false);
        router.refresh();
      } catch {
        await enqueue({
          type: 'no_show_ride',
          resource_id: rideId,
          payload: { motif: motif.trim() || undefined },
        });
        toast.warning('Déclaration enregistrée : sync au retour réseau.');
        reset();
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmer absence patient ?</DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de déclarer ce patient absent. Le régulateur sera notifié
            immédiatement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <Label htmlFor="no-show-motif">Motif (optionnel)</Label>
            <span
              className={
                'text-xs tabular-nums ' +
                (motif.length > MAX_MOTIF
                  ? 'text-destructive font-semibold'
                  : 'text-muted-foreground')
              }
            >
              {motif.length}/{MAX_MOTIF}
            </span>
          </div>
          <textarea
            id="no-show-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            maxLength={MAX_MOTIF + 1}
            placeholder="Ex. porte close, pas de réponse au téléphone…"
            className="border-input bg-background w-full rounded-md border px-12 py-8 text-base"
          />
        </div>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={pending}
            className="h-12"
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={pending || motif.length > MAX_MOTIF}
            className="h-14 text-base font-semibold"
          >
            {pending ? 'Envoi…' : 'Confirmer absence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
