'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ExcludedRide } from '@tap/optimizer-client';

const MAX_VISIBLE = 5;

type Props = {
  excludedRides: ExcludedRide[];
  /** Libellés des courses exclus (id → label lisible). */
  rideLabels?: Record<string, string>;
};

/**
 * Section des courses non incluses dans le calcul (D-17).
 *
 * Rendu uniquement si excludedRides.length > 0 — l'absence de section
 * signifie que toutes les courses ont été traitées.
 * Couleur ambre doublée du texte explicatif — WCAG 2.1 AA.
 */
export function ExcludedRidesSection({
  excludedRides,
  rideLabels = {},
}: Props): JSX.Element | null {
  const [showAll, setShowAll] = useState(false);

  if (excludedRides.length === 0) return null;

  const visible = showAll ? excludedRides : excludedRides.slice(0, MAX_VISIBLE);
  const hidden = excludedRides.length - MAX_VISIBLE;

  return (
    <section
      className="rounded-lg border border-amber-200 bg-amber-50 p-16"
      aria-label="Courses non incluses dans le calcul"
    >
      <div className="flex items-center gap-8">
        <Info className="h-16 w-16 shrink-0 text-amber-700" aria-hidden />
        <h2 className="text-base font-semibold text-amber-800">
          Courses non incluses dans le calcul
        </h2>
      </div>
      <p className="text-muted-foreground mt-8 text-sm">
        Ces courses n&apos;ont pas été prises en compte : adresse sans coordonnées géographiques.
        Elles doivent être affectées manuellement.
      </p>
      <ul className="mt-8 space-y-4">
        {visible.map((ride) => (
          <li key={ride.id} className="text-sm text-amber-800">
            {rideLabels[ride.id] ?? ride.id.slice(0, 8)} — Adresse sans coordonnées. À affecter
            manuellement.
          </li>
        ))}
      </ul>
      {!showAll && hidden > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-8 text-amber-700"
          onClick={() => setShowAll(true)}
        >
          Afficher toutes ({excludedRides.length})
        </Button>
      )}
    </section>
  );
}
