'use client';

import Link from 'next/link';
import {
  ArrowDown,
  ArrowLeft,
  MapPin,
  Navigation,
  Phone,
} from 'lucide-react';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { formatRelativeFr, formatTimeFr } from '@/lib/dates-fr';
import type { RideForDriverList } from '../_lib/queries';
import { RideActions } from './ride-actions.client';

const STATUS_BAR: Record<string, string> = {
  assignee: 'bg-muted',
  en_cours: 'bg-warning',
  terminee: 'bg-success',
  annulee_regulateur: 'bg-destructive/60',
  annulee_patient: 'bg-destructive/60',
  annulee_chauffeur: 'bg-destructive/60',
};

function joinAddress(
  street: string,
  postal: string | null,
  city: string | null,
): string {
  return [street, [postal, city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
}

interface Props {
  ride: RideForDriverList;
}

/**
 * Détail course chauffeur pleine page (Phase 3 / 03-E).
 *
 * - Bandeau couleur statut + retour /conduite
 * - Patient + heure en grand
 * - Adresses complètes (rue + cp/ville) avec téléphone tel:
 * - CTA sticky bottom-16 max-w aligné sur le main 640px
 */
export function RideDetail({ ride }: Props): JSX.Element {
  const fullName = `${ride.patient.nom} ${ride.patient.prenom}`.trim();
  const bar = STATUS_BAR[ride.status] ?? 'bg-muted';

  return (
    <div className="flex flex-col gap-24 pb-32">
      <Link
        href="/conduite"
        className={cn(
          'inline-flex items-center gap-8 text-sm text-muted-foreground',
          'transition-colors duration-150 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-fit',
        )}
      >
        <ArrowLeft className="h-16 w-16" aria-hidden />
        Ma journée
      </Link>

      <article className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className={cn('h-4 w-full', bar)} aria-hidden />
        <div className="flex flex-col gap-24 px-16 py-16 sm:px-24 sm:py-24">
          <div className="flex items-start gap-16">
            <InitialsAvatar
              name={fullName || 'Patient'}
              role="chauffeur"
              size={48}
            />
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-semibold tabular-nums">
                {formatTimeFr(ride.scheduled_at)}
              </div>
              <div className="text-lg font-semibold truncate">
                {fullName || 'Patient inconnu'}
              </div>
              {ride.patient.telephone && (
                <a
                  href={`tel:${ride.patient.telephone}`}
                  className={cn(
                    'mt-8 inline-flex items-center gap-8 text-sm font-medium tabular-nums',
                    'text-primary transition-colors duration-150 hover:underline',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                  )}
                >
                  <Phone className="h-16 w-16" aria-hidden />
                  {ride.patient.telephone}
                </a>
              )}
            </div>
          </div>

          <section className="space-y-12">
            <div className="flex gap-12">
              <MapPin
                className="h-16 w-16 shrink-0 text-muted-foreground mt-4"
                aria-hidden
              />
              <div className="flex-1">
                <div className="text-base">
                  {joinAddress(
                    ride.pickup_address,
                    ride.pickup_postal_code,
                    ride.pickup_city,
                  )}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-4">
                  Départ
                </div>
              </div>
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
              <div className="flex-1">
                <div className="text-base">
                  {joinAddress(
                    ride.dropoff_address,
                    ride.dropoff_postal_code,
                    ride.dropoff_city,
                  )}
                </div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mt-4">
                  Arrivée
                </div>
              </div>
            </div>
          </section>

          {ride.notes_regulateur && (
            <section className="rounded-md border border-border bg-muted/40 px-16 py-12">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Note régulation
              </div>
              <p className="text-sm whitespace-pre-line">
                {ride.notes_regulateur}
              </p>
            </section>
          )}

          {(ride.started_at || ride.ended_at) && (
            <section className="space-y-4 text-sm">
              {ride.started_at && (
                <div className="flex justify-between gap-12">
                  <span className="text-muted-foreground">Démarrée</span>
                  <span className="tabular-nums">
                    {formatRelativeFr(ride.started_at)}
                  </span>
                </div>
              )}
              {ride.ended_at && (
                <div className="flex justify-between gap-12">
                  <span className="text-muted-foreground">Terminée</span>
                  <span className="tabular-nums">
                    à {formatTimeFr(ride.ended_at)}
                  </span>
                </div>
              )}
            </section>
          )}
        </div>
      </article>

      <RideActions
        rideId={ride.id}
        status={ride.status}
        endedAt={ride.ended_at}
        variant="sticky"
      />
    </div>
  );
}
