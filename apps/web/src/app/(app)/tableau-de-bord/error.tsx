'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Frontière d'erreur du tableau de bord (Phase 06.8, upgrade 06.22).
 * Utilise le gabarit commun `<SegmentError>` qui capture l'erreur dans
 * Sentry et affiche la stack en dev uniquement.
 */
export default function TableauDeBordError({
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
      segment="app.tableau-de-bord"
      title="Le tableau de bord est momentanément indisponible"
      description="Réessayez dans un instant. Si le problème persiste, contactez le support."
    />
  );
}
