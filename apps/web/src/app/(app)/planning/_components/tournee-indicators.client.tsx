'use client';

import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';
import type { TourneeIndicator } from '../_lib/tournee-indicators';

/**
 * Ligne d'indicateurs d'une tournée (Module 5.12 lot C) — sous le nom du
 * chauffeur dans l'en-tête de ligne. Affiche UNIQUEMENT des mesures honnêtes :
 * nombre de courses, plage horaire (première → dernière prise en charge),
 * mutualisation (part de courses en groupe). Aucune durée ni amplitude en base
 * → pas d'« heures planifiées » ni de taux d'occupation inventé ; l'info-bulle
 * l'explicite.
 */
export function TourneeIndicators({
  indicator,
}: {
  indicator: TourneeIndicator | undefined;
}): JSX.Element | null {
  if (!indicator || indicator.count === 0) return null;

  const plage =
    indicator.firstAt && indicator.lastAt
      ? `${formatReunionTime(indicator.firstAt)}–${formatReunionTime(indicator.lastAt)}`
      : null;

  return (
    <span
      className="text-muted-foreground mt-2 block text-[11px] font-normal leading-tight"
      title="Durées de course et amplitude de service non disponibles en base : ni heures travaillées ni taux d'occupation calculés."
    >
      <span className="tabular-nums">
        {indicator.count} course{indicator.count > 1 ? 's' : ''}
      </span>
      {plage ? <span className="tabular-nums"> · {plage}</span> : null}
      {indicator.mutualisees > 0 ? (
        <span className="block tabular-nums">
          {indicator.mutualisees} mutualisée{indicator.mutualisees > 1 ? 's' : ''} (
          {indicator.tauxMutualisation}&nbsp;%)
        </span>
      ) : null}
    </span>
  );
}
