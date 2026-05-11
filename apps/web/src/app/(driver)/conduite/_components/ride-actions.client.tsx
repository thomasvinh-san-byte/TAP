'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startRideAction } from '../actions';
import { formatTimeFr } from '@/lib/dates-fr';
import { EndRideModal } from './end-ride-modal.client';

/**
 * CTA contextuel d'une course chauffeur (Phase 3 / 03-E).
 *
 * Statut → action :
 *   - assignee  → bouton primaire "Démarrer la course" (startRideAction)
 *   - en_cours  → bouton primaire "Clôturer la course" (ouvre EndRideModal)
 *   - terminee  → badge "Terminée à HHhMM"
 *   - annulee_* → badge neutre "Course annulée"
 *
 * Hauteur fixe h-14 (56px) pour cohérence pouce mobile (CLAUDE.md § 5).
 */

interface Props {
  rideId: string;
  status: string;
  endedAt: string | null;
  variant?: 'inline' | 'sticky';
}

export function RideActions({
  rideId,
  status,
  endedAt,
  variant = 'inline',
}: Props): JSX.Element {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);

  const onStart = async () => {
    setPending(true);
    const res = await startRideAction(rideId);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Course démarrée.');
    router.refresh();
  };

  if (status === 'terminee') {
    return (
      <div className="flex h-14 items-center justify-center rounded-md border border-success/30 bg-success/10 text-sm font-medium text-success tabular-nums">
        Terminée{endedAt ? ` à ${formatTimeFr(endedAt)}` : ''}
      </div>
    );
  }

  if (status.startsWith('annulee')) {
    return (
      <div className="flex h-14 items-center justify-center rounded-md border border-border bg-muted text-sm font-medium text-muted-foreground">
        Course annulée
      </div>
    );
  }

  const stickyCls =
    variant === 'sticky'
      ? 'sticky bottom-16 mx-auto w-full max-w-[608px]'
      : '';

  if (status === 'en_cours') {
    return (
      <>
        <div className={stickyCls}>
          <Button
            type="button"
            onClick={() => setEndOpen(true)}
            className="h-14 w-full text-base font-semibold"
          >
            Clôturer la course
          </Button>
        </div>
        <EndRideModal
          rideId={rideId}
          open={endOpen}
          onOpenChange={setEndOpen}
        />
      </>
    );
  }

  // assignee (par défaut)
  return (
    <div className={stickyCls}>
      <Button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="h-14 w-full text-base font-semibold"
      >
        {pending ? (
          <>
            <Loader2 className="mr-8 h-16 w-16 animate-spin" aria-hidden />
            Démarrage…
          </>
        ) : (
          'Démarrer la course'
        )}
      </Button>
    </div>
  );
}
