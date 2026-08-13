'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';
import { computeHourRange, hourSlots, hourLabel, reunionHour } from '../_lib/planning-layout';
import { statusBlockClass, statusLabel } from '../_lib/planning-status';
import type { PlanningDriverOption } from '../_lib/planning-queries';

interface Props {
  rides: CockpitRide[];
  drivers: PlanningDriverOption[];
  onSelect: (rideId: string) => void;
}

const UNASSIGNED = '__unassigned__';

function patientShort(ride: CockpitRide): string {
  const p = ride.patient;
  if (!p) return 'Patient';
  const nom = p.nom?.trim();
  const prenom = p.prenom?.trim();
  if (nom && prenom) return `${nom} ${prenom[0]}.`;
  return nom || prenom || 'Patient';
}

/**
 * Grille planning (Module 5.12 lot A) — LECTURE SEULE. Tableau sémantique
 * (accessible : en-têtes de colonnes = heures, en-têtes de lignes = chauffeurs)
 * : lignes = chauffeurs (+ « Non affectées » en tête, prioritaire pour la
 * régulation), colonnes = tranches horaires. Chaque course tombe dans la
 * tranche de son heure prévue (fuseau Réunion). Statut = couleur + texte.
 * Défilement horizontal sur petit écran (outil desktop régulateur).
 */
export function PlanningGrid({ rides, drivers, onSelect }: Props): JSX.Element {
  const range = React.useMemo(() => computeHourRange(rides.map((r) => r.scheduled_at)), [rides]);
  const slots = React.useMemo(() => hourSlots(range), [range]);

  // Regroupe les courses par (clé de ligne, heure). Clé de ligne = chauffeur ou
  // « non affectées ».
  const byCell = React.useMemo(() => {
    const map = new Map<string, CockpitRide[]>();
    for (const r of rides) {
      const h = reunionHour(r.scheduled_at);
      if (h < 0) continue;
      const rowKey = r.driver_id ?? UNASSIGNED;
      const key = `${rowKey}|${h}`;
      const list = map.get(key);
      if (list) list.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [rides]);

  // Lignes : « Non affectées » d'abord, puis chauffeurs du référentiel, puis tout
  // chauffeur présent dans les courses mais absent du référentiel (défensif).
  const rows = React.useMemo(() => {
    const knownIds = new Set(drivers.map((d) => d.id));
    const extra = new Map<string, string>();
    for (const r of rides) {
      if (r.driver_id && !knownIds.has(r.driver_id)) {
        extra.set(r.driver_id, r.driver?.nom_affichage?.trim() || 'Chauffeur');
      }
    }
    const unassignedCount = rides.filter((r) => !r.driver_id).length;
    return [
      {
        id: UNASSIGNED,
        label: `Non affectées${unassignedCount > 0 ? ` (${unassignedCount})` : ''}`,
      },
      ...drivers,
      ...[...extra.entries()].map(([id, label]) => ({ id, label })),
    ];
  }, [drivers, rides]);

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">
          Planning des tournées : lignes = chauffeurs, colonnes = tranches horaires. Cliquer une
          course pour en voir le détail.
        </caption>
        <thead>
          <tr className="border-border bg-muted/40 border-b">
            <th
              scope="col"
              className="text-muted-foreground bg-muted/40 sticky left-0 z-10 px-12 py-8 text-left text-xs font-semibold uppercase tracking-wide"
            >
              Chauffeur
            </th>
            {slots.map((h) => (
              <th
                key={h}
                scope="col"
                className="text-muted-foreground min-w-[96px] px-8 py-8 text-left text-xs font-semibold tabular-nums"
              >
                {hourLabel(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isUnassigned = row.id === UNASSIGNED;
            return (
              <tr
                key={row.id}
                className={cn('border-border border-b', isUnassigned && 'bg-warning/5')}
              >
                <th
                  scope="row"
                  className={cn(
                    'bg-background sticky left-0 z-10 max-w-[160px] truncate px-12 py-8 text-left align-top text-sm font-medium',
                    isUnassigned && 'text-warning',
                  )}
                  title={row.label}
                >
                  {row.label}
                </th>
                {slots.map((h) => {
                  const cell = byCell.get(`${row.id}|${h}`) ?? [];
                  return (
                    <td key={h} className="min-w-[96px] px-4 py-4 align-top">
                      <div className="flex flex-col gap-4">
                        {cell.map((ride) => (
                          <button
                            key={ride.id}
                            type="button"
                            onClick={() => onSelect(ride.id)}
                            className={cn(
                              'focus-visible:ring-ring w-full rounded-md border-l-4 px-8 py-4 text-left transition-shadow',
                              'hover:shadow-elev-sm focus-visible:outline-none focus-visible:ring-2',
                              statusBlockClass(ride.status),
                            )}
                            aria-label={`${formatReunionTime(ride.scheduled_at)} · ${patientShort(
                              ride,
                            )} · ${statusLabel(ride.status)}`}
                          >
                            <span className="flex items-baseline gap-4">
                              <span className="text-xs font-semibold tabular-nums">
                                {formatReunionTime(ride.scheduled_at)}
                              </span>
                              <span className="truncate text-xs">{patientShort(ride)}</span>
                            </span>
                            <span className="text-muted-foreground block truncate text-[11px] leading-tight">
                              {statusLabel(ride.status)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
