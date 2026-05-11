'use client';

import Link from 'next/link';
import { ArrowDown, MapPin, Navigation } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { formatTimeFr } from '@/lib/dates-fr';
import type { RideForDriverList } from '../_lib/queries';
import { RideActions } from './ride-actions.client';

/**
 * Carte course chauffeur (Phase 3 / 03-E — référence Things 3 today view).
 *
 * - Bandeau couleur 4px en haut, sémantique selon statut
 * - Heure + patient en gros, adresses denses au-dessus du CTA
 * - Click sur la carte (hors CTA) → /conduite/[rideId] détail
 * - CTA pleine largeur h-14 (56px) en bas
 */

const STATUS_BAR: Record<string, string> = {
  assignee: 'bg-muted',
  en_cours: 'bg-warning',
  terminee: 'bg-success',
  annulee_regulateur: 'bg-destructive/60',
  annulee_patient: 'bg-destructive/60',
  annulee_chauffeur: 'bg-destructive/60',
};

interface Props {
  ride: RideForDriverList;
}

export function RideCard({ ride }: Props): JSX.Element {
  const fullName = `${ride.patient.nom} ${ride.patient.prenom}`.trim();
  const bar = STATUS_BAR[ride.status] ?? 'bg-muted';

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-background',
        'shadow-sm transition-shadow duration-150 hover:shadow-md',
      )}
    >
      <div className={cn('h-4 w-full', bar)} aria-hidden />
      <Link
        href={`/conduite/${ride.id}`}
        className={cn(
          'block px-16 py-16 transition-colors duration-150',
          'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        <div className="flex items-start gap-12">
          <InitialsAvatar
            name={fullName || 'Patient'}
            role="chauffeur"
            size={32}
          />
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-semibold tabular-nums text-foreground">
              {formatTimeFr(ride.scheduled_at)}
            </div>
            <div className="text-base font-semibold truncate">
              {fullName || 'Patient inconnu'}
            </div>
          </div>
        </div>

        <div className="mt-16 space-y-8 text-base">
          <div className="flex gap-12">
            <MapPin
              className="h-16 w-16 shrink-0 text-muted-foreground mt-4"
              aria-hidden
            />
            <span className="flex-1 truncate">{ride.pickup_address}</span>
          </div>
          <ArrowDown
            className="h-12 w-12 ml-4 text-muted-foreground"
            aria-hidden
          />
          <div className="flex gap-12">
            <Navigation
              className="h-16 w-16 shrink-0 text-muted-foreground mt-4"
              aria-hidden
            />
            <span className="flex-1 truncate">{ride.dropoff_address}</span>
          </div>
        </div>
      </Link>
      <div className="px-16 pb-16">
        <RideActions
          rideId={ride.id}
          status={ride.status}
          endedAt={ride.ended_at}
        />
      </div>
    </article>
  );
}
