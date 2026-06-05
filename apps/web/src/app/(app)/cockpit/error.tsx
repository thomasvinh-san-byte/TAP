'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary `/cockpit` (régulatrice 8h/j).
 *
 * Le contexte de régulation (courses, ride en cours) est volatil. Le
 * message invite à recharger sans laisser entendre que des courses sont
 * perdues — Realtime se reconnectera au prochain render.
 */
export default function CockpitError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <SegmentError
      error={error}
      reset={reset}
      segment="app.cockpit"
      title="Le cockpit est temporairement indisponible"
      description="Vos courses et alertes ne sont pas perdues. Réessayez pour rouvrir le cockpit ; la régulation reprendra le contexte courant."
    />
  );
}
