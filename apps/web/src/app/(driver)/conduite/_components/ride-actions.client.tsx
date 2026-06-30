'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { enqueue } from '@/lib/offline/sync-engine';
import { getDb } from '@/lib/offline/dexie-instance';
import type { MutationType } from '@/lib/offline/dexie-schema';
import { formatTimeFr } from '@/lib/dates-fr';
import { captureCurrentPosition } from '@/lib/geoloc/capture-current-position.client';
import { SlideToConfirm } from './slide-to-confirm.client';
import { EndRideModal } from './end-ride-modal.client';
import { NoShowButton } from './no-show-button.client';

/**
 * CTA contextuel d'une course (Phase 3 / 03-E, étendu PWA-01 §5.16).
 *
 * Bouton géant unique, libellé selon la séquence de prise en charge :
 *   assignee         → « Je pars »            (start  → en_cours)
 *   en_cours         → « Arrivé sur place »   (arrive → arrive_sur_place)
 *   arrive_sur_place → « Patient à bord »     (board  → patient_a_bord)
 *   patient_a_bord   → « Terminer la course » (ouvre la clôture tarif/paiement)
 *   terminee / annulee_* → badge
 *
 * Confirmation par GLISSEMENT (anti-appui accidentel à une main) en complément
 * du contrôle visible. Chaque transition passe par le mode hors-ligne (file de
 * mutations rejouable, FIFO par course). Cible ≥ 56 px, zone basse (sticky).
 */

interface Props {
  rideId: string;
  status: string;
  endedAt: string | null;
  variant?: 'inline' | 'sticky';
}

interface Step {
  label: string;
  path: string;
  mutationType: MutationType;
  success: string;
  /** Capture la position (DEC-096) — seulement au démarrage. */
  withPosition?: boolean;
}

const STEPS: Record<string, Step> = {
  assignee: {
    label: 'Je pars',
    path: 'start',
    mutationType: 'start_ride',
    success: 'Course démarrée.',
    withPosition: true,
  },
  en_cours: {
    label: 'Arrivé sur place',
    path: 'arrive',
    mutationType: 'arrive_ride',
    success: 'Arrivée enregistrée.',
  },
  arrive_sur_place: {
    label: 'Patient à bord',
    path: 'board',
    mutationType: 'board_ride',
    success: 'Patient à bord.',
  },
};

/** États où l'action « Patient absent » reste pertinente (avant embarquement). */
const NO_SHOW_STATES = new Set(['assignee', 'en_cours', 'arrive_sur_place']);

export function RideActions({ rideId, status, endedAt, variant = 'inline' }: Props): JSX.Element {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [endOpen, setEndOpen] = React.useState(false);

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

  const runTransition = React.useCallback(
    async (step: Step) => {
      setPending(true);
      const idempotency_key = crypto.randomUUID();
      const payload: Record<string, unknown> = step.withPosition
        ? await captureCurrentPosition()
        : {};
      try {
        if (!navigator.onLine) throw new Error('offline');
        const res = await fetch(`/api/driver/rides/${rideId}/${step.path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotency_key, ...payload }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          const errorMsg = data.error ?? `HTTP ${res.status}`;
          // 4xx = erreur métier définitive : afficher, ne pas mettre en file.
          if (res.status >= 400 && res.status < 500) {
            toast.error(errorMsg);
            setPending(false);
            return;
          }
          throw new Error(errorMsg); // 5xx → file
        }
        toast.success(step.success);
        router.refresh();
      } catch {
        await enqueue({ type: step.mutationType, resource_id: rideId, payload });
        toast.warning('Action enregistrée : sync au retour réseau.');
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [rideId, router],
  );

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

  const step = STEPS[status];
  const blocked = pending || hasPendingSync;

  return (
    <div className={stickyCls}>
      {status === 'patient_a_bord' ? (
        <SlideToConfirm
          label={hasPendingSync ? 'Clôture en attente de sync…' : 'Terminer la course'}
          onConfirm={() => setEndOpen(true)}
          disabled={blocked}
        />
      ) : step ? (
        <SlideToConfirm
          label={hasPendingSync ? 'En attente de sync…' : step.label}
          onConfirm={() => void runTransition(step)}
          disabled={blocked}
        />
      ) : null}

      {NO_SHOW_STATES.has(status) && (
        <div className="border-border mt-24 border-t pt-16">
          <NoShowButton rideId={rideId} />
        </div>
      )}

      <EndRideModal rideId={rideId} open={endOpen} onOpenChange={setEndOpen} />
    </div>
  );
}
