'use client';

import { SegmentError } from '@/components/error/segment-error.client';

/**
 * Phase 06.22 — Boundary `/conduite` (chauffeur en course, terrain).
 *
 * Critique : ce chauffeur peut être hors couverture réseau au moment du
 * crash. Le bouton « Réessayer » ne dépend QUE de Next.js (`reset()` =
 * re-render local du segment, pas de RSC fetch obligatoire), donc
 * fonctionne offline. Le message rassure explicitement sur la file
 * offline (sync engine Phase 04.9) : les pointages mis en file (start /
 * end / no-show) ne sont jamais perdus.
 *
 * Aucun assertion de présence réseau, aucun composant lourd (icône),
 * aucune dépendance qui pourrait casser si un chunk est manquant.
 */
export default function ConduiteError({
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
      segment="driver.conduite"
      title="Un problème d’affichage est survenu"
      description="Vos pointages sont sauvegardés sur l’appareil et seront synchronisés au retour du réseau. Aucun pointage n’est perdu. Réessayez pour réafficher votre journée."
    />
  );
}
