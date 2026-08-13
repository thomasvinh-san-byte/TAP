'use client';

import * as React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { isModifiableStatus } from '@tap/shared';
import { cn } from '@/lib/utils';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';
import { computeHourRange, hourSlots, hourLabel, reunionHour } from '../_lib/planning-layout';
import { statusBlockClass, statusLabel } from '../_lib/planning-status';
import type { PlanningDriverOption } from '../_lib/planning-queries';
import type { TourneeIndicator } from '../_lib/tournee-indicators';
import { TourneeIndicators } from './tournee-indicators.client';

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
const DRAG_MIME = 'application/x-tap-ride';

function patientShort(ride: CockpitRide): string {
  const p = ride.patient;
  if (!p) return 'Patient';
  const nom = p.nom?.trim();
  const prenom = p.prenom?.trim();
  if (nom && prenom) return `${nom} ${prenom[0]}.`;
  return nom || prenom || 'Patient';
}

/**
 * Grille planning (Module 5.12 lots A + B + C). Tableau sémantique (accessible :
 * en-têtes de colonnes = heures, en-têtes de lignes = chauffeurs) : lignes =
 * chauffeurs (+ « Non affectées » en tête, prioritaire pour la régulation),
 * colonnes = tranches horaires. Chaque course tombe dans la tranche de son heure
 * prévue (fuseau Réunion). Statut = couleur + texte. Lot B : glisser-déposer
 * d'une course entre lignes (réaffectation) + action « Réaffecter » clavier. Lot
 * C : indicateurs de tournée sous chaque chauffeur. Défilement horizontal sur
 * petit écran (outil desktop régulateur).
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
            const isOver = dragOverRow === row.id;
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-border border-b transition-colors',
                  isUnassigned && 'bg-warning/5',
                  isOver &&
                    'bg-primary/10 outline-primary outline-dashed outline-2 -outline-offset-2',
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverRow !== row.id) setDragOverRow(row.id);
                }}
                onDragLeave={(e) => {
                  // Ne réinitialise que si l'on quitte réellement la ligne.
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDragOverRow((cur) => (cur === row.id ? null : cur));
                  }
                }}
                onDrop={handleDrop(row.id)}
              >
                <th
                  scope="row"
                  className={cn(
                    'bg-background sticky left-0 z-10 max-w-[180px] px-12 py-8 text-left align-top text-sm font-medium',
                    isUnassigned && 'text-warning',
                    isOver && 'bg-primary/10',
                  )}
                >
                  <span className="block truncate" title={row.label}>
                    {row.label}
                  </span>
                  {!isUnassigned ? <TourneeIndicators indicator={indicators.get(row.id)} /> : null}
                </th>
                {slots.map((h) => {
                  const cell = byCell.get(`${row.id}|${h}`) ?? [];
                  return (
                    <td key={h} className="min-w-[96px] px-4 py-4 align-top">
                      <div className="flex flex-col gap-4">
                        {cell.map((ride) => {
                          const draggable = isModifiableStatus(ride.status);
                          return (
                            <div key={ride.id} className="group relative">
                              <button
                                type="button"
                                draggable={draggable}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(DRAG_MIME, ride.id);
                                  e.dataTransfer.setData('text/plain', ride.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                onClick={() => onSelect(ride.id)}
                                className={cn(
                                  'focus-visible:ring-ring w-full rounded-md border-l-4 px-8 py-4 text-left transition-shadow',
                                  'hover:shadow-elev-sm focus-visible:outline-none focus-visible:ring-2',
                                  draggable && 'cursor-grab active:cursor-grabbing',
                                  statusBlockClass(ride.status),
                                )}
                                title={
                                  draggable
                                    ? 'Cliquer pour le détail · glisser pour réaffecter'
                                    : undefined
                                }
                                aria-label={`${formatReunionTime(
                                  ride.scheduled_at,
                                )} · ${patientShort(ride)} · ${statusLabel(ride.status)}`}
                              >
                                <span className="flex items-baseline gap-4 pr-16">
                                  <span className="text-xs font-semibold tabular-nums">
                                    {formatReunionTime(ride.scheduled_at)}
                                  </span>
                                  <span className="truncate text-xs">{patientShort(ride)}</span>
                                </span>
                                <span className="text-muted-foreground block truncate text-[11px] leading-tight">
                                  {statusLabel(ride.status)}
                                </span>
                              </button>
                              {draggable ? (
                                <button
                                  type="button"
                                  onClick={() => onReassignRide(ride.id)}
                                  className={cn(
                                    'text-muted-foreground hover:text-foreground hover:bg-background focus-visible:ring-ring absolute right-2 top-2 rounded p-2',
                                    'opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover:opacity-100',
                                  )}
                                  aria-label={`Réaffecter la course de ${patientShort(ride)}`}
                                  title="Réaffecter"
                                >
                                  <ArrowLeftRight className="h-12 w-12" aria-hidden />
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
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
