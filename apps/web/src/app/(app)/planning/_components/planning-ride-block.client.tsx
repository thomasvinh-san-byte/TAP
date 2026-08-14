'use client';

import * as React from 'react';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';
import { isModifiableStatus } from '@tap/shared';
import { cn } from '@/lib/utils';
import type { CockpitRide } from '../../cockpit/_lib/types';
import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';
import { statusBlockClass, statusLabel } from '../_lib/planning-status';

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
}

/**
 * Bloc-course de la grille planning (Module 5.12, raffinement Gantt). Un bloc
 * clair et dense : heure · patient, statut (couleur de liseré + libellé texte —
 * jamais la couleur seule, WCAG 1.4.1), et trajet abrégé départ → arrivée quand
 * l'adresse existe. Cible ≥ 44 px (accessibilité). Clic → détail (RideDrawer,
 * inchangé) ; glisser → réaffectation (lot B, inchangé) avec repli clavier
 * (bouton « Réaffecter »). Survol : légère élévation.
 */
export function PlanningRideBlock({
  ride,
  onSelect,
  onReassign,
  onDragStateChange,
}: Props): JSX.Element {
  const draggable = isModifiableStatus(ride.status);
  const from = shortPlace(ride.pickup_address);
  const to = shortPlace(ride.dropoff_address);
  const hasTrajet = from !== '' && to !== '';

  return (
    <div className="group relative">
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
        title={draggable ? 'Cliquer pour le détail · glisser pour réaffecter' : undefined}
        aria-label={`${formatReunionTime(ride.scheduled_at)} · ${patientShort(ride)} · ${statusLabel(
          ride.status,
        )}${hasTrajet ? ` · ${from} vers ${to}` : ''}`}
      >
        <span className="flex items-baseline gap-4 pr-16">
          <span className="text-foreground whitespace-nowrap text-xs font-semibold tabular-nums">
            {formatReunionTime(ride.scheduled_at)}
          </span>
          <span className="text-foreground truncate text-xs font-medium">{patientShort(ride)}</span>
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
