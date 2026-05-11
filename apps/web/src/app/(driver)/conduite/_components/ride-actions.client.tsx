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
 * CTA contextuel d'une course (Phase 3 / 03-E).
 *
 * Statut → action (couleurs alignées sur conduite-maquette.html) :
 *   - assignee  → bouton primary « Démarrer la course »
 *   - en_cours  → bouton warning orange « Clôturer la course »
 *   - terminee  → badge success h-14 « Terminée à HHhMM »
 *   - annulee_* → badge neutre h-14 « Course annulée »
 *
 * Hauteur fixe h-14 (56 px) pour cible tactile pouce mobile (CLAUDE.md § 5).
 * Variant `sticky` : utilisé en page détail, le CTA se colle en bas du
 * viewport pour rester accessible sans scroll.
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
      ? 'sticky bottom-0 -mx-16 sm:-mx-24 px-16 sm:px-24 py-12 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 border-t border-border'
      : '';

  if (status === 'en_cours') {
    return (
      <>
        <div className={stickyCls}>
          <Button
            type="button"
            onClick={() => setEndOpen(true)}
            className="h-14 w-full text-base font-semibold bg-warning text-white hover:bg-warning/90 focus-visible:ring-warning"
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
