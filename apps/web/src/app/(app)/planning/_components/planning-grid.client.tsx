'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { useNow } from '../../cockpit/_lib/use-now';
import {
  computeHourRange,
  hourSlots,
  hourLabel,
  reunionHour,
  reunionHourMinute,
} from '../_lib/planning-layout';
import type { PlanningDriverOption } from '../_lib/planning-queries';
import type { TourneeIndicator } from '../_lib/tournee-indicators';
import { TourneeIndicators } from './tournee-indicators.client';
import { PlanningRideBlock, DRAG_MIME } from './planning-ride-block.client';
import { PlanningNowLine } from './planning-now-line.client';

interface Props {
  rides: CockpitRide[];
  drivers: PlanningDriverOption[];
  onSelect: (rideId: string) => void;
  /** Dépose d'une course sur une ligne (`null` = « Non affectées »). Lot B. */
  onDropRide: (rideId: string, targetDriverId: string | null) => void;
  /** Ouvre la réaffectation clavier (alternative au glisser-déposer). Lot B. */
  onReassignRide: (rideId: string) => void;
  /** Indicateurs de tournée par chauffeur (`driver_id` → indicateur). Lot C. */
  indicators: Map<string, TourneeIndicator>;
}

const UNASSIGNED = '__unassigned__';

interface Row {
  id: string;
  label: string;
  count: number;
}

/**
 * Grille planning — vrai Gantt de régulation (Module 5.12 lots A + B + C,
 * raffinement visuel). Tableau sémantique (accessible : en-têtes de colonnes =
 * heures, en-têtes de lignes = chauffeurs). Lignes = chauffeurs (+ « Non
 * affectées » en tête, prioritaire), colonnes = tranches horaires (fuseau
 * Réunion). Repère vertical « maintenant » live, grille de fond (colonnes
 * horaires + séparateurs de lignes + zébrage discret), tranches passées
 * estompées, blocs-courses enrichis, lignes vides travaillées (discrètes, pas un
 * trou blanc). Données/calculs et glisser-déposer (lot B) inchangés — habillage
 * seulement.
 */
export function PlanningGrid({
  rides,
  drivers,
  onSelect,
  onDropRide,
  onReassignRide,
  indicators,
}: Props): JSX.Element {
  const range = React.useMemo(() => computeHourRange(rides.map((r) => r.scheduled_at)), [rides]);
  const slots = React.useMemo(() => hourSlots(range), [range]);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Horloge partagée (repère « maintenant » + estompage des tranches passées).
  const nowMs = useNow(30_000);
  const nowHour = React.useMemo(
    () => reunionHourMinute(new Date(nowMs).toISOString())?.hour ?? -1,
    [nowMs],
  );

  // Ligne survolée pendant un glisser (retour visuel de la zone de dépose).
  const [dragOverRow, setDragOverRow] = React.useState<string | null>(null);

  const handleDrop = (rowId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverRow(null);
    const rideId = e.dataTransfer.getData(DRAG_MIME) || e.dataTransfer.getData('text/plain');
    if (!rideId) return;
    onDropRide(rideId, rowId === UNASSIGNED ? null : rowId);
  };

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
  const rows = React.useMemo<Row[]>(() => {
    const knownIds = new Set(drivers.map((d) => d.id));
    const extra = new Map<string, string>();
    const countByRow = new Map<string, number>();
    for (const r of rides) {
      const rowKey = r.driver_id ?? UNASSIGNED;
      countByRow.set(rowKey, (countByRow.get(rowKey) ?? 0) + 1);
      if (r.driver_id && !knownIds.has(r.driver_id)) {
        extra.set(r.driver_id, r.driver?.nom_affichage?.trim() || 'Chauffeur');
      }
    }
    const unassignedCount = countByRow.get(UNASSIGNED) ?? 0;
    return [
      {
        id: UNASSIGNED,
        label: `Non affectées${unassignedCount > 0 ? ` (${unassignedCount})` : ''}`,
        count: unassignedCount,
      },
      ...drivers.map((d) => ({ id: d.id, label: d.label, count: countByRow.get(d.id) ?? 0 })),
      ...[...extra.entries()].map(([id, label]) => ({ id, label, count: countByRow.get(id) ?? 0 })),
    ];
  }, [drivers, rides]);

  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <div ref={containerRef} className="relative min-w-full">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">
            Planning des tournées : lignes = chauffeurs, colonnes = tranches horaires. Repère
            vertical « maintenant » à l&apos;heure courante. Cliquer une course pour en voir le
            détail.
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
                  data-hour={h}
                  className={cn(
                    'border-border/50 text-muted-foreground min-w-[92px] border-l px-8 py-6 text-left text-xs font-semibold tabular-nums',
                    // Tranche passée estompée : concentre l'attention sur le présent/à venir.
                    nowHour >= 0 && h < nowHour && 'text-muted-foreground/50',
                  )}
                >
                  {hourLabel(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let driverIndex = -1;
              return rows.map((row) => {
                const isUnassigned = row.id === UNASSIGNED;
                const isOver = dragOverRow === row.id;
                const isEmpty = row.count === 0;
                if (!isUnassigned) driverIndex += 1;
                // Zébrage discret des lignes chauffeurs (une sur deux) — repère de
                // lecture « quel chauffeur » sans surcharge.
                const zebra = !isUnassigned && driverIndex % 2 === 1;

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-border border-b transition-colors',
                      zebra && 'bg-muted/20',
                      // « Non affectées » : mise en valeur quand elle contient des
                      // courses (priorité de régulation), discrète quand vide.
                      isUnassigned && (isEmpty ? 'bg-muted/10' : 'bg-warning/10'),
                      isOver &&
                        'bg-primary/10 outline-primary outline-dashed outline-2 -outline-offset-2',
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverRow !== row.id) setDragOverRow(row.id);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        setDragOverRow((cur) => (cur === row.id ? null : cur));
                      }
                    }}
                    onDrop={handleDrop(row.id)}
                  >
                    <th
                      scope="row"
                      className={cn(
                        'bg-background sticky left-0 z-10 max-w-[180px] px-12 text-left align-top text-sm font-medium',
                        // Ligne vide → compacte (moins d'espace mort vertical).
                        isEmpty && !isUnassigned ? 'py-4' : 'py-8',
                        isUnassigned && !isEmpty && 'text-warning',
                        isOver && 'bg-primary/10',
                      )}
                    >
                      <span className="block truncate" title={row.label}>
                        {row.label}
                      </span>
                      {!isUnassigned ? (
                        <TourneeIndicators indicator={indicators.get(row.id)} />
                      ) : null}
                    </th>

                    {isEmpty && !isUnassigned ? (
                      // Ligne chauffeur sans course : discrète et lisible « aucune
                      // course » — pas un grand vide blanc. Reste zone de dépose (lot B).
                      <td
                        colSpan={slots.length}
                        className="text-muted-foreground/60 px-8 py-4 text-left text-xs italic"
                      >
                        Aucune course
                      </td>
                    ) : (
                      slots.map((h) => {
                        const cell = byCell.get(`${row.id}|${h}`) ?? [];
                        const isPast = nowHour >= 0 && h < nowHour;
                        return (
                          <td
                            key={h}
                            className={cn(
                              'border-border/50 min-w-[92px] border-l px-4 py-4 align-top',
                              // Fond estompé des tranches passées (sous les blocs).
                              isPast && 'bg-muted/15',
                            )}
                          >
                            {cell.length > 0 ? (
                              <div className="flex flex-col gap-4">
                                {cell.map((ride) => (
                                  <PlanningRideBlock
                                    key={ride.id}
                                    ride={ride}
                                    onSelect={onSelect}
                                    onReassign={onReassignRide}
                                  />
                                ))}
                              </div>
                            ) : null}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
        <PlanningNowLine containerRef={containerRef} slots={slots} nowMs={nowMs} />
      </div>
    </div>
  );
}
