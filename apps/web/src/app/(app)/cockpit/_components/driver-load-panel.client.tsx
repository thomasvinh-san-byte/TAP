'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import {
  computeDriverBalance,
  firstReassignableRideId,
  type DriverBalanceEntry,
  type DriverRosterEntry,
} from '../_lib/driver-load';
import type { CockpitRide } from '../_lib/types';
import { cn } from '@/lib/utils';

/**
 * Panneau « Charge par chauffeur » (§5.13, COCKPIT-03) — outil d'ÉQUILIBRAGE.
 *
 * Montre la répartition des courses AFFECTÉES du jour (statuts affectées / en
 * cours / terminées) entre chauffeurs, barre relative au plus chargé. Ce N'EST
 * PAS un taux d'occupation (pas de capacité ni de durées en base — on ne
 * l'invente pas). Utilité dispatch : voir le déséquilibre (les plus chargés vs
 * les disponibles, chauffeurs à 0 course inclus) et AGIR — cliquer un chauffeur
 * chargé ouvre une de ses courses (RideDrawer déjà branché) pour la réaffecter à
 * un disponible. Accent réservé aux extrêmes (surchargé / disponible).
 */
export function DriverLoadPanel({
  rides,
  driverLabels,
  roster,
  onOpenRide,
  detailHref,
}: {
  rides: CockpitRide[];
  driverLabels: Record<string, string>;
  /** Référentiel chauffeurs actifs (drivers.id → nom) pour inclure les 0 course. */
  roster: DriverRosterEntry[];
  /** Ouvre le RideDrawer sur une course (état unique du cockpit) — action de
   *  redistribution depuis un chauffeur chargé. */
  onOpenRide: (rideId: string) => void;
  /** Renvoi optionnel vers la vue détaillée (tableau de bord), selon le rôle. */
  detailHref?: string;
}): JSX.Element {
  const { entries, max } = useMemo(
    () => computeDriverBalance(rides, roster, driverLabels),
    [rides, roster, driverLabels],
  );

  return (
    <div className="flex h-full flex-col">
      <header className="mb-12 flex items-start justify-between gap-8">
        <div className="min-w-0">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Charge par chauffeur
          </h2>
          <p
            className="text-muted-foreground mt-2 text-xs"
            title="Comptées : courses affectées, en cours, terminées. Pas un taux d'occupation."
          >
            Répartition des courses du jour — barre relative au plus chargé.
          </p>
        </div>
        {detailHref && (
          <Link
            href={detailHref}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-4 rounded-md text-xs font-medium focus:outline-none focus-visible:ring-2"
          >
            Voir tout
            <ArrowUpRight className="h-12 w-12" aria-hidden />
          </Link>
        )}
      </header>

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun chauffeur actif.</p>
      ) : (
        // Corps borné + défilement interne (même motif que le panneau alertes) :
        // avec beaucoup de chauffeurs, la liste défile au lieu d'étirer le
        // panneau latéral. `pr-4` réserve l'espace de la barre de défilement.
        <ul className="flex max-h-[280px] flex-col gap-12 overflow-y-auto pr-4">
          {entries.map((e) => (
            <DriverRow
              key={e.driver_id}
              entry={e}
              max={max}
              rideId={e.count > 0 ? firstReassignableRideId(rides, e.driver_id) : null}
              onOpenRide={onOpenRide}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Une ligne de charge. Cliquable (bouton) si le chauffeur a une course à
 * redistribuer ; sinon ligne informative (disponible, rien à ouvrir). L'état de
 * déséquilibre est perceptible au-delà de la couleur (libellé « le plus
 * sollicité » / « disponible » + le compte en clair).
 */
function DriverRow({
  entry,
  max,
  rideId,
  onOpenRide,
}: {
  entry: DriverBalanceEntry;
  max: number;
  rideId: string | null;
  onOpenRide: (rideId: string) => void;
}): JSX.Element {
  const ratio = max > 0 ? entry.count / max : 0;
  const countLabel = `${entry.count} course${entry.count > 1 ? 's' : ''}`;

  const body = (
    <>
      <div className="flex items-baseline justify-between gap-12">
        <span className="flex min-w-0 items-baseline gap-8">
          <span className="truncate text-sm font-medium">{entry.nom}</span>
          {entry.isMostLoaded && (
            <span className="text-warning shrink-0 text-[11px] font-medium">le plus sollicité</span>
          )}
          {entry.isAvailable && (
            <span className="text-success shrink-0 text-[11px] font-medium">disponible</span>
          )}
        </span>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{countLabel}</span>
      </div>
      <div
        className="bg-muted mt-4 h-8 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${entry.nom} : ${countLabel}`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-150',
            entry.isMostLoaded ? 'bg-warning' : 'bg-primary',
          )}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </>
  );

  // Chauffeur chargé → bouton : ouvre une course à réaffecter (redistribution).
  if (rideId) {
    return (
      <li>
        <button
          type="button"
          onClick={() => onOpenRide(rideId)}
          aria-label={`${entry.nom} — ${countLabel}${entry.isMostLoaded ? ', le plus sollicité' : ''}. Ouvrir une course à redistribuer.`}
          className="hover:bg-muted/60 focus-visible:ring-ring w-full space-y-4 rounded-md p-4 text-left transition-colors focus:outline-none focus-visible:ring-2"
        >
          {body}
        </button>
      </li>
    );
  }

  // Chauffeur disponible (0 course) → ligne informative, cible de redistribution.
  return <li className="space-y-4 p-4">{body}</li>;
}
