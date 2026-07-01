'use client';

import Link from 'next/link';
import { ArrowDown, ArrowLeft, MapPin, Navigation, Phone, Route } from 'lucide-react';
import { buildNavigationUrl } from '@tap/shared';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { formatRelativeFr, formatTimeFr } from '@/lib/dates-fr';
import type { RideForDriverList } from '../_lib/queries';
import { RideActions } from './ride-actions.client';
import { RideChat } from '@/components/messaging/ride-chat.client';

const STATUS_BAR: Record<string, string> = {
  assignee: 'bg-muted',
  en_cours: 'bg-warning',
  arrive_sur_place: 'bg-warning',
  patient_a_bord: 'bg-warning',
  terminee: 'bg-success',
  annulee_regulateur: 'bg-destructive/60',
  annulee_patient: 'bg-destructive/60',
  annulee_chauffeur: 'bg-destructive/60',
  annulee_meteo: 'bg-destructive/60',
};

function joinAddress(street: string, postal: string | null, city: string | null): string {
  return [street, [postal, city].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}

interface Props {
  ride: RideForDriverList;
}

/**
 * Détail course pleine page (Phase 3 / 03-E — cf. conduite-maquette.html).
 *
 *   - Bandeau couleur statut + lien retour /conduite
 *   - Patient + heure en grand, téléphone patient cliquable (tel:)
 *   - Adresses complètes (rue + cp + ville) groupées avec MapPin /
 *     ArrowDown / Navigation
 *   - CTA contextuel sticky bottom-0 (au ras du bas du viewport,
 *     barre de fond translucide pour rester visible au-dessus du
 *     contenu qui défile).
 */
export function RideDetail({ ride }: Props): JSX.Element {
  const fullName = `${ride.patient.nom} ${ride.patient.prenom}`.trim();
  const bar = STATUS_BAR[ride.status] ?? 'bg-muted';
  // PWA-02 (§5.16) : énoncé vocal au démarrage — nom + adresse de départ
  // uniquement (déjà à l'écran, aucune donnée médicale).
  const pickup = joinAddress(ride.pickup_address, ride.pickup_postal_code, ride.pickup_city);
  const announceAtStart = [fullName, pickup].filter(Boolean).join('. ');

  // PWA-03 (§5.16) : navigation externe. Le point visé suit l'état de la course
  // — destination une fois le patient à bord, prise en charge avant. Coordonnées
  // privilégiées, repli sur l'adresse (helper pur @tap/shared). Bouton affiché
  // seulement pour une course active et si une cible existe (pas de bouton mort).
  const goingToDropoff = ride.status === 'patient_a_bord';
  const navUrl = buildNavigationUrl(
    goingToDropoff
      ? {
          lat: ride.dropoff_lat,
          lng: ride.dropoff_lng,
          address: joinAddress(ride.dropoff_address, ride.dropoff_postal_code, ride.dropoff_city),
        }
      : { lat: ride.pickup_lat, lng: ride.pickup_lng, address: pickup },
  );
  const NAVIGABLE_STATUSES = ['assignee', 'en_cours', 'arrive_sur_place', 'patient_a_bord'];
  const showNav = navUrl !== null && NAVIGABLE_STATUSES.includes(ride.status);

  return (
    <div className="flex flex-col gap-24 pb-32">
      <Link
        href="/conduite"
        className={cn(
          'text-muted-foreground inline-flex items-center gap-8 text-sm',
          'hover:text-foreground transition-colors duration-150',
          'focus-visible:ring-ring w-fit rounded-sm focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        <ArrowLeft className="h-16 w-16" aria-hidden />
        Ma journée
      </Link>

      <article className="border-border bg-background overflow-hidden rounded-lg border shadow-sm">
        <div className={cn('h-4 w-full', bar)} aria-hidden />
        <div className="flex flex-col gap-24 px-16 py-16 sm:px-24 sm:py-24">
          <div className="flex items-start gap-16">
            <InitialsAvatar name={fullName || 'Patient'} role="chauffeur" size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-3xl font-semibold tabular-nums">
                {formatTimeFr(ride.scheduled_at)}
              </div>
              <div className="truncate text-lg font-semibold">{fullName || 'Patient inconnu'}</div>
              {ride.patient.telephone && (
                <a
                  href={`tel:${ride.patient.telephone}`}
                  className={cn(
                    'mt-8 inline-flex items-center gap-8 text-sm font-medium tabular-nums',
                    'text-primary transition-colors duration-150 hover:underline',
                    'focus-visible:ring-ring rounded-sm focus-visible:outline-none focus-visible:ring-2',
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
              <MapPin className="text-muted-foreground mt-4 h-16 w-16 shrink-0" aria-hidden />
              <div className="flex-1">
                <div className="text-base">
                  {joinAddress(ride.pickup_address, ride.pickup_postal_code, ride.pickup_city)}
                </div>
                <div className="text-muted-foreground mt-4 text-xs uppercase tracking-wide">
                  Départ
                </div>
              </div>
            </div>
            <ArrowDown className="text-muted-foreground ml-4 h-12 w-12" aria-hidden />
            <div className="flex gap-12">
              <Navigation className="text-muted-foreground mt-4 h-16 w-16 shrink-0" aria-hidden />
              <div className="flex-1">
                <div className="text-base">
                  {joinAddress(ride.dropoff_address, ride.dropoff_postal_code, ride.dropoff_city)}
                </div>
                <div className="text-muted-foreground mt-4 text-xs uppercase tracking-wide">
                  Arrivée
                </div>
              </div>
            </div>

            {showNav && (
              <a
                href={navUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex min-h-[48px] items-center justify-center gap-8 rounded-md',
                  'bg-primary text-primary-foreground text-base font-semibold',
                  'transition-colors duration-150 hover:opacity-90 active:opacity-80',
                  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                )}
              >
                <Route className="h-16 w-16" aria-hidden />
                {goingToDropoff ? 'Y aller — destination' : 'Y aller — prise en charge'}
              </a>
            )}
          </section>

          {ride.notes_regulateur && (
            <section className="border-border bg-muted/40 rounded-md border px-16 py-12">
              <div className="text-muted-foreground mb-4 text-xs font-semibold uppercase tracking-wide">
                Note régulation
              </div>
              <p className="whitespace-pre-line text-sm">{ride.notes_regulateur}</p>
            </section>
          )}

          {(ride.started_at || ride.ended_at) && (
            <section className="space-y-4 text-sm">
              {ride.started_at && (
                <div className="flex justify-between gap-12">
                  <span className="text-muted-foreground">Démarrée</span>
                  <span className="tabular-nums">{formatRelativeFr(ride.started_at)}</span>
                </div>
              )}
              {ride.ended_at && (
                <div className="flex justify-between gap-12">
                  <span className="text-muted-foreground">Terminée</span>
                  <span className="tabular-nums">à {formatTimeFr(ride.ended_at)}</span>
                </div>
              )}
            </section>
          )}
        </div>
      </article>

      <section className="border-border bg-background rounded-lg border px-16 py-16 shadow-sm">
        <RideChat rideId={ride.id} className="max-h-[280px] min-h-[140px]" />
      </section>

      <RideActions
        rideId={ride.id}
        status={ride.status}
        endedAt={ride.ended_at}
        variant="sticky"
        announceAtStart={announceAtStart}
      />
    </div>
  );
}
