'use client';

import Link from 'next/link';
import { ArrowDown, MapPin, Navigation } from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { formatTimeFr } from '@/lib/dates-fr';
import type { RideForDriverList } from '../_lib/queries';
import { RideActions } from './ride-actions.client';

/**
 * Carte course (Phase 3 / 03-E — cf. conduite-maquette.html).
 *
 *   - Bandeau couleur 4 px en haut, sémantique selon statut
 *   - Heure scheduled_at text-2xl tabular-nums + patient + meta muted
 *     (mode transport · urgence)
 *   - Trajet pickup → dropoff dans un sous-bloc `bg-muted/50` ; le
 *     contraste léger délimite visuellement l'information « adresses »
 *     sans alourdir.
 *   - Click carte (hors CTA) → page détail /conduite/[rideId].
 *   - CTA pleine largeur h-14 (56 px) en bas, couleur selon statut
 *     (cf. <RideActions>).
 */

const STATUS_BAR: Record<string, string> = {
  assignee: 'bg-muted',
  en_cours: 'bg-warning',
  terminee: 'bg-success',
  annulee_regulateur: 'bg-destructive/60',
  annulee_patient: 'bg-destructive/60',
  annulee_chauffeur: 'bg-destructive/60',
};

const MODE_LABEL: Record<string, string> = {
  taxi_conventionne: 'Taxi conv.',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

const URGENCY_LABEL: Record<string, string> = {
  programmee: 'Programmée',
  urgente: 'Urgente',
  immediate: 'Immédiate',
};

function buildMeta(ride: RideForDriverList): string {
  const parts = [
    MODE_LABEL[ride.transport_mode] ?? ride.transport_mode,
    URGENCY_LABEL[ride.urgency] ?? ride.urgency,
  ];
  return parts.filter(Boolean).join(' · ');
}

interface Props {
  ride: RideForDriverList;
}

export function RideCard({ ride }: Props): JSX.Element {
  const fullName = `${ride.patient.nom} ${ride.patient.prenom}`.trim();
  const bar = STATUS_BAR[ride.status] ?? 'bg-muted';

  return (
    <article
      className={cn(
        'border-border bg-background overflow-hidden rounded-lg border',
        'shadow-sm transition-shadow duration-150 hover:shadow-md',
      )}
    >
      <div className={cn('h-4 w-full', bar)} aria-hidden />
      <Link
        href={`/conduite/${ride.id}`}
        className={cn(
          'block px-16 py-16 transition-colors duration-150',
          'hover:bg-muted/30 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
        )}
      >
        <div className="flex items-start gap-12">
          <InitialsAvatar name={fullName || 'Patient'} role="chauffeur" size={32} />
          <div className="min-w-0 flex-1">
            <div className="text-foreground text-2xl font-semibold tabular-nums">
              {formatTimeFr(ride.scheduled_at)}
            </div>
            <div className="truncate text-base font-semibold">{fullName || 'Patient inconnu'}</div>
            <div className="text-muted-foreground mt-4 text-xs">{buildMeta(ride)}</div>
          </div>
        </div>

        <div className="bg-muted/50 mt-16 space-y-4 rounded-md px-12 py-12 text-base">
          <div className="flex gap-12">
            <MapPin className="text-muted-foreground mt-4 h-16 w-16 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{ride.pickup_address}</span>
          </div>
          <ArrowDown className="text-muted-foreground ml-4 h-12 w-12" aria-hidden />
          <div className="flex gap-12">
            <Navigation className="text-muted-foreground mt-4 h-16 w-16 shrink-0" aria-hidden />
            <span className="flex-1 truncate">{ride.dropoff_address}</span>
          </div>
        </div>
      </Link>
      <div className="px-16 pb-16">
        <RideActions rideId={ride.id} status={ride.status} endedAt={ride.ended_at} />
      </div>
    </article>
  );
}
