'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary segment `(admin)` : settings, chauffeurs, véhicules,
 * tarifs, légal, facturation, maintenance.
 */
export default function AdminSegmentError({
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
      segment="admin"
      title="Une page d’administration est temporairement indisponible"
      description="Aucune donnée n’a été modifiée. Réessayez dans un instant. Si l’erreur revient, contactez le support."
    />
  );
}
