'use client';

import { useMemo } from 'react';
import { computeDriverLoads } from '../_lib/driver-load';
import type { CockpitRide } from '../_lib/types';

/**
 * Panneau « charge relative par chauffeur » (§5.13, COCKPIT-03). Jauge
 * COMPARATIVE : remplissage = courses du chauffeur / chauffeur le plus chargé.
 * Ce N'EST PAS un pourcentage d'occupation — l'information vraie est le NOMBRE de
 * courses, affiché en clair ; la jauge n'aide qu'à comparer. Pas de barres ASCII.
 */
export function DriverLoadPanel({
  rides,
  driverLabels,
}: {
  rides: CockpitRide[];
  driverLabels: Record<string, string>;
}): JSX.Element {
  const { loads, max } = useMemo(
    () => computeDriverLoads(rides, driverLabels),
    [rides, driverLabels],
  );

  return (
    <div className="flex h-full flex-col">
      <header className="mb-12">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Charge par chauffeur
        </h2>
        <p className="text-muted-foreground mt-2 text-xs">
          Nombre de courses du jour (comparatif).
        </p>
      </header>

      {loads.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune course affectée.</p>
      ) : (
        <ul className="flex flex-col gap-12">
          {loads.map((l) => {
            // Proportion RELATIVE au plus chargé (jamais une division par zéro :
            // si loads est non vide, max ≥ 1). Ce n'est pas un taux d'occupation.
            const ratio = max > 0 ? l.count / max : 0;
            return (
              <li key={l.driver_id} className="space-y-4">
                <div className="flex items-baseline justify-between gap-12">
                  <span className="truncate text-sm font-medium">{l.nom}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {l.count} course{l.count > 1 ? 's' : ''}
                  </span>
                </div>
                <div
                  className="bg-muted h-8 w-full overflow-hidden rounded-full"
                  role="img"
                  aria-label={`${l.nom} : ${l.count} course${l.count > 1 ? 's' : ''}`}
                >
                  <div
                    className="bg-primary h-full rounded-full transition-[width] duration-150"
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
