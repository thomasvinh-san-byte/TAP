'use client';

import * as React from 'react';
import { ArrowLeftRight, ArrowRight, MapPin, Flag } from 'lucide-react';
import { isModifiableStatus } from '@tap/shared';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';
import { MODE_LABEL } from '../../courses/_components/ride-badges';
import { statusBlockClass, statusLabel } from '../_lib/planning-status';
import type { PlanningRideMeta } from '../_lib/planning-queries';

/** Type MIME du glisser-déposer d'une course (partagé grille ↔ bloc). Lot B. */
export const DRAG_MIME = 'application/x-tap-ride';

function patientShort(ride: CockpitRide): string {
  const p = ride.patient;
  if (!p) return 'Patient';
  const nom = p.nom?.trim();
  const prenom = p.prenom?.trim();
  if (nom && prenom) return `${nom} ${prenom[0]}.`;
  return nom || prenom || 'Patient';
}

function patientFull(ride: CockpitRide): string {
  const p = ride.patient;
  const name = p ? [p.nom, p.prenom].filter(Boolean).join(' ').trim() : '';
  return name || 'Patient';
}

/**
 * Commune d'une adresse (dernier segment, code postal retiré) pour un trajet
 * abrégé « départ → arrivée » lisible. Purement présentationnel : on n'affiche
 * que ce qui existe déjà (adresses de course), sans rien inventer.
 */
function shortPlace(address: string | null): string {
  if (!address) return '';
  const last = address.split(',').pop()?.trim() ?? '';
  return last.replace(/^\d{5}\s*/, '').trim() || last;
}

interface Props {
  ride: CockpitRide;
  onSelect: (rideId: string) => void;
  onReassign: (rideId: string) => void;
  /**
   * Signale le début/fin d'un glisser (id de la course, ou `null` à la fin) — la
   * grille s'en sert pour évaluer la dépose EN AMONT (retour visuel
   * constraint-aware). Optionnel : le glisser de base fonctionne sans.
   */
  onDragStateChange?: (rideId: string | null) => void;
  /** Métadonnées de la course (type de transport, donneur d'ordres) — carte de survol. */
  meta?: PlanningRideMeta;
}

/**
 * Carte de survol (détail sans clic) d'un bloc-course. Réutilise la primitive
 * Radix `Tooltip` (portalisée — échappe au débordement de la grille — déclenchée
 * au survol ET au focus clavier, WCAG 1.4.13). Le clic ouvre toujours le drawer
 * pour l'action ; la carte ne fait que RENSEIGNER. Aucune donnée inventée.
 */
function RideHoverCard({
  ride,
  meta,
}: {
  ride: CockpitRide;
  meta?: PlanningRideMeta;
}): JSX.Element {
  const typeLabel = meta?.transport_mode
    ? (MODE_LABEL[meta.transport_mode] ?? meta.transport_mode)
    : null;
  const donneur = meta?.ordering_party_label ?? null;
  return (
    <div className="flex w-[260px] flex-col gap-8 text-left">
      <div className="flex items-baseline justify-between gap-8">
        <span className="text-sm font-semibold tabular-nums">
          {formatReunionTime(ride.scheduled_at)}
        </span>
        <span
          className={cn(
            'rounded-full border-l-4 px-8 py-1 text-[11px] font-medium',
            statusBlockClass(ride.status),
          )}
        >
          {statusLabel(ride.status)}
        </span>
      </div>
      <div className="text-sm font-medium">{patientFull(ride)}</div>
      <div className="text-muted-foreground flex flex-col gap-4 text-xs">
        <span className="flex items-start gap-4">
          <MapPin className="mt-2 h-12 w-12 shrink-0" aria-hidden />
          <span>{ride.pickup_address}</span>
        </span>
        <span className="flex items-start gap-4">
          <Flag className="mt-2 h-12 w-12 shrink-0" aria-hidden />
          <span>{ride.dropoff_address ?? 'Destination non renseignée'}</span>
        </span>
      </div>
      {typeLabel || donneur ? (
        <div className="text-muted-foreground flex flex-wrap gap-x-12 gap-y-2 text-[11px]">
          {typeLabel ? <span>Type : {typeLabel}</span> : null}
          {donneur ? <span>Donneur : {donneur}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Bloc-course de la grille planning (Module 5.12, raffinement Gantt). Un bloc
 * clair et dense : heure · patient, statut (couleur de liseré + libellé texte —
 * jamais la couleur seule, WCAG 1.4.1), et trajet abrégé départ → arrivée quand
 * l'adresse existe. Cible ≥ 44 px (accessibilité). Survol / focus → carte de
 * détail (sans clic) ; clic → détail (RideDrawer, inchangé) ; glisser →
 * réaffectation (lot B, inchangé) avec repli clavier (bouton « Réaffecter »).
 */
export function PlanningRideBlock({
  ride,
  onSelect,
  onReassign,
  onDragStateChange,
  meta,
}: Props): JSX.Element {
  const draggable = isModifiableStatus(ride.status);
  const from = shortPlace(ride.pickup_address);
  const to = shortPlace(ride.dropoff_address);
  const hasTrajet = from !== '' && to !== '';

  return (
    <div className="group relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            draggable={draggable}
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_MIME, ride.id);
              e.dataTransfer.setData('text/plain', ride.id);
              e.dataTransfer.effectAllowed = 'move';
              onDragStateChange?.(ride.id);
            }}
            onDragEnd={() => onDragStateChange?.(null)}
            onClick={() => onSelect(ride.id)}
            className={cn(
              'focus-visible:ring-ring flex min-h-[44px] w-full flex-col justify-center gap-2 rounded-md border border-l-4 px-8 py-4 text-left',
              'hover:shadow-elev-md transition-shadow focus-visible:outline-none focus-visible:ring-2',
              draggable && 'cursor-grab active:cursor-grabbing',
              statusBlockClass(ride.status),
            )}
            aria-label={`${formatReunionTime(ride.scheduled_at)} · ${patientShort(
              ride,
            )} · ${statusLabel(ride.status)}${hasTrajet ? ` · ${from} vers ${to}` : ''}`}
          >
            <span className="flex items-baseline gap-4 pr-16">
              <span className="text-foreground whitespace-nowrap text-xs font-semibold tabular-nums">
                {formatReunionTime(ride.scheduled_at)}
              </span>
              <span className="text-foreground truncate text-xs font-medium">
                {patientShort(ride)}
              </span>
            </span>
            <span className="text-muted-foreground text-[11px] font-medium leading-tight">
              {statusLabel(ride.status)}
            </span>
            {hasTrajet ? (
              <span className="text-muted-foreground flex items-center gap-2 truncate text-[11px] leading-tight">
                <span className="truncate">{from}</span>
                <ArrowRight className="h-8 w-8 shrink-0" aria-hidden />
                <span className="truncate">{to}</span>
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          className="bg-popover text-popover-foreground border-border max-w-none border p-12 shadow-md"
        >
          <RideHoverCard ride={ride} meta={meta} />
        </TooltipContent>
      </Tooltip>
      {draggable ? (
        <button
          type="button"
          onClick={() => onReassign(ride.id)}
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
}
