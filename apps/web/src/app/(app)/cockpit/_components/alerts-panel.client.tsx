'use client';

import { useState } from 'react';
import { AlertCard } from './alert-card.client';
import type { CockpitAlert } from '../_lib/types';

/**
 * Nombre d'alertes affichées d'emblée. Le reste est replié derrière « + N autres »
 * pour que la zone d'alertes ne repousse jamais le contenu primaire hors de l'écran.
 * L'ordre reçu est déjà trié par urgence (la plus urgente en premier) — on n'y
 * touche pas : on affiche les premières.
 */
const DEFAULT_VISIBLE = 4;

export function AlertsPanel({
  alerts,
  onOpenRide,
}: {
  alerts: CockpitAlert[];
  /** Ouvre le drawer course depuis une alerte qui porte un `ride_id` (état unique
   *  du cockpit). Transmis tel quel à chaque `AlertCard`. */
  onOpenRide?: (rideId: string) => void;
}): JSX.Element {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? alerts : alerts.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = alerts.length - visible.length;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-8 flex items-center justify-between">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Alertes
        </h2>
        {/* Compteur global conservé : il porte le volume, la liste n'a pas à tout étaler. */}
        {alerts.length > 0 && (
          <span className="bg-destructive/10 text-destructive inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-8 text-xs font-semibold">
            {alerts.length}
          </span>
        )}
      </header>
      {alerts.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune alerte.</p>
      ) : (
        <>
          {/* Liste dense (séparateurs fins, pas de cartes) + hauteur bornée avec
              défilement interne si beaucoup d'alertes. */}
          <ul className="divide-border max-h-[280px] divide-y overflow-y-auto pr-4">
            {visible.map((alert) => (
              <li key={alert.id}>
                <AlertCard alert={alert} onOpenRide={onOpenRide} />
              </li>
            ))}
          </ul>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-8 self-start rounded-md text-xs font-medium underline focus:outline-none focus-visible:ring-2"
            >
              + {hiddenCount} autre{hiddenCount > 1 ? 's' : ''}
            </button>
          )}
          {showAll && alerts.length > DEFAULT_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-8 self-start rounded-md text-xs font-medium underline focus:outline-none focus-visible:ring-2"
            >
              Voir moins
            </button>
          )}
        </>
      )}
    </div>
  );
}
