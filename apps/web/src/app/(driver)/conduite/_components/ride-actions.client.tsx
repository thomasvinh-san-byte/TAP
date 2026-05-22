'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { enqueue } from '@/lib/offline/sync-engine';
import { getDb } from '@/lib/offline/dexie-instance';
import { formatTimeFr } from '@/lib/dates-fr';
import { EndRideModal } from './end-ride-modal.client';
import { NoShowButton } from './no-show-button.client';

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

export function RideActions({ rideId, status, endedAt, variant = 'inline' }: Props): JSX.Element {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);

  // Track mutations en queue Dexie pour ce ride (Phase 04.9-bis #3).
  // Pattern industry 2026 : « track pending operations with visible
  // status line » (tasking.space PWA Edge Sync 2026, TanStack Query
  // useMutation isPending). Évite la duplication enqueue post-refresh
  // quand state local pending est reset par router.refresh().
  const pendingForThisRide = useLiveQuery(
    () => {
      if (typeof window === 'undefined') return 0;
      return getDb()
        .mutations_queue.where('resource_id')
        .equals(rideId)
        .filter((m) => m.status !== 'dead')
        .count();
    },
    [rideId],
    0,
  );
  const hasPendingSync = (pendingForThisRide ?? 0) > 0;

  const onStart = async () => {
    setPending(true);
    const idempotency_key = crypto.randomUUID();

    try {
      if (!navigator.onLine) {
        throw new Error('offline');
      }

      const res = await fetch(`/api/driver/rides/${rideId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const errorMsg = data.error ?? `HTTP ${res.status}`;

        // Erreurs métier (4xx) : afficher sans enqueue (retry serait vain)
        if (res.status >= 400 && res.status < 500) {
          toast.error(errorMsg);
          setPending(false);
          return;
        }

        // 5xx : enqueue pour retry au retour
        throw new Error(errorMsg);
      }

      toast.success('Course démarrée.');
      router.refresh();
    } catch {
      await enqueue({
        type: 'start_ride',
        resource_id: rideId,
        payload: {},
      });
      toast.warning('Mutation enregistrée — sync au retour réseau');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  if (status === 'terminee') {
    return (
      <div className="border-success/30 bg-success/10 text-success flex h-14 items-center justify-center rounded-md border text-sm font-medium tabular-nums">
        Terminée{endedAt ? ` à ${formatTimeFr(endedAt)}` : ''}
      </div>
    );
  }

  if (status.startsWith('annulee')) {
    return (
      <div className="border-border bg-muted text-muted-foreground flex h-14 items-center justify-center rounded-md border text-sm font-medium">
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
            disabled={hasPendingSync}
            className="bg-warning hover:bg-warning/90 focus-visible:ring-warning h-14 w-full text-base font-semibold text-white disabled:opacity-60"
          >
            {hasPendingSync ? 'Clôture en attente de sync…' : 'Clôturer la course'}
          </Button>
        </div>
        <EndRideModal rideId={rideId} open={endOpen} onOpenChange={setEndOpen} />
      </>
    );
  }

  // assignee (par défaut)
  return (
    <div className={stickyCls}>
      <Button
        type="button"
        onClick={onStart}
        disabled={pending || hasPendingSync}
        className="h-14 w-full text-base font-semibold"
      >
        {pending ? (
          <>
            <Loader2 className="mr-8 h-16 w-16 animate-spin" aria-hidden />
            Démarrage…
          </>
        ) : hasPendingSync ? (
          'Démarrage en attente de sync…'
        ) : (
          'Démarrer la course'
        )}
      </Button>
      {/* « Patient absent » : action lourde (course perdue). Écart large +
          frontière pour la détacher du CTA — anti clic accidentel (retour
          terrain). Hiérarchie secondaire DEC-014 inchangée. */}
      <div className="mt-24 border-t border-border pt-16">
        <NoShowButton rideId={rideId} />
      </div>
    </div>
  );
}
