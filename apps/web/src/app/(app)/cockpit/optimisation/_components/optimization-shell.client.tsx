'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ComparativeView } from './comparative-view';
import { ApplyConfirmationDialog } from './apply-confirmation-dialog.client';
import { useOptimization } from '../_lib/use-optimization.client';
type CurrentRide = {
  id: string;
  scheduled_at: string;
  pickup_address?: string;
  dropoff_address?: string;
};

type Props = {
  initialRides: CurrentRide[];
  date: string;
};

/**
 * Orchestrateur client de l'écran d'optimisation (Surface 1-7).
 *
 * Gère la machine d'états idle/loading/result/empty/error (D-05/D-14/D-17/D-18).
 * Lance l'optimisation au mount automatiquement pour UX fluide.
 */
export function OptimizationShell({ initialRides, date }: Props): JSX.Element {
  const { state, decisions, adjustments, launch, accept, reject, adjust, acceptedGroupements } =
    useOptimization(date);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasAccepted = acceptedGroupements.length > 0;

  // Wave 4 — véhicules et labels viennent enrichis par le Route Handler.
  const availableVehicles: { id: string; label: string }[] =
    state.status === 'result' ? (state.proposal.vehicles ?? []) : [];
  const rideLabels = state.status === 'result' ? (state.proposal.rideLabels ?? {}) : {};

  // Message empty spécifique quand toutes les courses sont exclues sans coordonnées.
  const emptyDueToNoCoords =
    state.status === 'empty' &&
    state.excludedRides.length > 0 &&
    state.excludedRides.every((r) => r.reason === 'no_coordinates');

  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between gap-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Optimisation du{' '}
          {new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </h1>
        <div className="flex items-center gap-8">
          {state.status === 'result' && (
            <Button
              variant="outline"
              onClick={() => void launch()}
              title="Recalculer en partant des courses actuelles. Les ajustements en cours seront perdus."
              data-testid="recalculate-btn"
            >
              ↻ Re-calculer
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/cockpit">Fermer</Link>
          </Button>
        </div>
      </header>

      {state.status === 'idle' && (
        <div className="flex flex-col items-center gap-16 py-48">
          <p className="text-muted-foreground text-sm">
            Cliquez sur « Lancer le calcul » pour analyser les courses de cette journée.
          </p>
          <Button onClick={() => void launch()}>Lancer le calcul</Button>
        </div>
      )}

      {state.status === 'loading' && (
        <div data-testid="optimization-skeleton" className="space-y-16">
          <p className="text-muted-foreground text-sm">
            Calcul en cours… cela peut prendre quelques secondes.
          </p>
          <div className="grid gap-16 sm:grid-cols-2">
            <div className="space-y-8">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
            <div className="space-y-8">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-40 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-48 rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div className="bg-background flex flex-col items-center gap-8 py-48 text-center">
          <h2 className="text-base font-semibold">Aucun groupement proposé</h2>
          {emptyDueToNoCoords ? (
            <p className="text-muted-foreground max-w-md text-sm">
              Aucune course exploitable : les {state.excludedRides.length} course
              {state.excludedRides.length > 1 ? 's' : ''} de la journée n&apos;ont pas de
              coordonnées géographiques. L&apos;optimisation nécessite des adresses géocodées.
            </p>
          ) : (
            <p className="text-muted-foreground max-w-md text-sm">
              Aucune course compatible n&apos;a été identifiée pour cette journée. Vérifiez les
              horaires ou les adresses saisies.
            </p>
          )}
          <Button variant="outline" onClick={() => void launch()} className="mt-8">
            Réessayer
          </Button>
        </div>
      )}

      {state.status === 'error' && (
        <div className="flex flex-col items-center gap-8 py-48 text-center">
          <p className="text-muted-foreground max-w-md text-sm">{state.message}</p>
          <Button variant="outline" onClick={() => void launch()} className="mt-8">
            Réessayer
          </Button>
        </div>
      )}

      {state.status === 'result' && (
        <>
          <ComparativeView
            proposal={state.proposal}
            currentRides={initialRides}
            decisions={decisions}
            availableVehicles={availableVehicles}
            rideLabels={rideLabels}
            onAccept={accept}
            onReject={reject}
            onAdjust={adjust}
          />

          <div className="flex justify-end gap-8 pt-8">
            <Button
              variant="default"
              className="min-h-[44px]"
              onClick={() => setConfirmOpen(true)}
              disabled={!hasAccepted}
              data-testid="apply-groupements-btn"
            >
              Appliquer les groupements acceptés
            </Button>
          </div>

          <ApplyConfirmationDialog
            open={confirmOpen}
            onCancel={() => setConfirmOpen(false)}
            acceptedGroupements={acceptedGroupements}
            adjustments={adjustments}
          />
        </>
      )}
    </div>
  );
}
