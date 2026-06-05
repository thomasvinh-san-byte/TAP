'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary segment `(driver)` : surface PWA chauffeur. Message
 * rassurant qui insiste sur la file offline. Le bouton Réessayer fonctionne
 * sans réseau (reset Next 15 = re-render local, pas de RSC server fetch).
 */
export default function DriverSegmentError({
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
      segment="driver"
      title="Un problème d’affichage est survenu"
      description="Vos pointages sont sauvegardés et seront synchronisés au retour du réseau. Réessayez."
    />
  );
}
