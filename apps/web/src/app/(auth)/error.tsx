'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary segment `(auth)` : login, accept-invite.
 * Ne bloque pas la reconnexion : le bouton Réessayer relance le segment
 * sans purger la session ni le formulaire.
 */
export default function AuthSegmentError({
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
      segment="auth"
      title="Connexion temporairement indisponible"
      description="Réessayez ou rechargez la page. Vos identifiants n’ont pas été envoyés tant que le formulaire n’a pas été soumis."
    />
  );
}
