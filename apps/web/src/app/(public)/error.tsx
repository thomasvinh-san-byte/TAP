'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary segment `(public)` : pages légales CGU/CGV/cookies
 * + portail patient `/legal/request/[token]`.
 */
export default function PublicSegmentError({
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
      segment="public"
      title="Page momentanément indisponible"
      description="Réessayez ou rechargez la page. Si le problème persiste, contactez le service support."
    />
  );
}
