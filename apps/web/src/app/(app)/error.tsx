'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary segment `(app)` : régulation, courses, patients,
 * cockpit, optimisation. Couvre toutes les pages régulateur / dirigeant
 * qui n'ont pas leur propre `error.tsx` plus spécifique.
 */
export default function AppSegmentError({
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
      segment="app"
      title="Un problème d’affichage est survenu"
      description="Vos données ne sont pas perdues. Réessayez ou rechargez la page. Si le problème persiste, contactez le support."
    />
  );
}
