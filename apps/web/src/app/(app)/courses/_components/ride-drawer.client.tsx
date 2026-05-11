'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, MapPin, Navigation } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import {
  formatDateTimeFr,
  formatRelativeFr,
  formatTimeFr,
} from '@/lib/dates-fr';
import {
  getRideAuditLogAction,
  getRideByIdAction,
  unassignRideAction,
} from '../actions';
import { ModeBadge, PaymentBadge, StatusBadge, UrgencyBadge } from './ride-badges';
import { RideAuditTimeline } from './ride-audit-timeline';
import { RidePaymentPopover } from './ride-payment-popover.client';
import { useRideOrchestrator } from './ride-orchestrator-context.client';

interface Props {
  rideId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRequestAssign: (rideId: string) => void;
}

/**
 * Drawer course (Phase 3 / 03-D — référence Plain/Linear activity).
 *
 * Sections empilées : header → trajet → mode/urgence → assignation →
 * exécution → paiement → historique. Server Actions appelées pour mutate
 * (unassign + paiement). useQuery + invalidate sur succès → recharge la
 * liste courses + drawer.
 */
export function RideDrawer({
  rideId,
  open,
  onOpenChange,
  onRequestAssign,
}: Props): JSX.Element {
  const qc = useQueryClient();
  const { dispatch } = useRideOrchestrator();
  const [payOpen, setPayOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const rideQuery = useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => getRideByIdAction(rideId!),
    enabled: open && rideId !== null,
    staleTime: 5_000,
  });
  const auditQuery = useQuery({
    queryKey: ['ride-audit', rideId],
    queryFn: () => getRideAuditLogAction(rideId!),
    enabled: open && rideId !== null,
    staleTime: 5_000,
  });

  const ride = rideQuery.data;
  const audit = auditQuery.data ?? [];

  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['ride', rideId] }),
      qc.invalidateQueries({ queryKey: ['ride-audit', rideId] }),
      qc.invalidateQueries({ queryKey: ['rides'] }),
    ]);
  };

  const onUnassign = async () => {
    if (!rideId) return;
    setPending(true);
    const res = await unassignRideAction(rideId);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Chauffeur désassigné.');
    await invalidate();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:w-[480px] sm:max-w-[480px] overflow-y-auto"
      >
        {rideQuery.isPending || !ride ? (
          <DrawerSkeleton />
        ) : (
          <div className="space-y-24">
            <SheetHeader className="flex flex-row items-center justify-between gap-12">
              <SheetTitle>Course</SheetTitle>
              {(ride.status === 'validee' || ride.status === 'assignee') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    dispatch({ type: 'OPEN_EDIT', rideId: ride.id });
                    onOpenChange(false);
                  }}
                >
                  Modifier
                </Button>
              )}
            </SheetHeader>

            <section className="space-y-12">
              <div className="flex items-center gap-12">
                {ride.patient && (
                  <InitialsAvatar
                    name={`${ride.patient.nom} ${ride.patient.prenom}`}
                    size={48}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {ride.patient
                      ? `${ride.patient.nom} ${ride.patient.prenom}`
                      : 'Patient inconnu'}
                  </div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    {formatDateTimeFr(ride.scheduled_at)}
                  </div>
                </div>
                <StatusBadge status={ride.status} />
              </div>
            </section>

            <section className="space-y-8">
              <SectionTitle>Trajet</SectionTitle>
              <div className="flex flex-col gap-8">
                <div className="flex gap-12">
                  <MapPin className="h-16 w-16 text-muted-foreground shrink-0 mt-4" aria-hidden />
                  <div className="flex-1">
                    <div className="text-sm">{ride.pickup_address}</div>
                    <div className="text-xs text-muted-foreground">
                      {[ride.pickup_postal_code, ride.pickup_city]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                  </div>
                </div>
                <ArrowDown
                  className="h-12 w-12 text-muted-foreground ml-4"
                  aria-hidden
                />
                <div className="flex gap-12">
                  <Navigation className="h-16 w-16 text-muted-foreground shrink-0 mt-4" aria-hidden />
                  <div className="flex-1">
                    <div className="text-sm">{ride.dropoff_address}</div>
                    <div className="text-xs text-muted-foreground">
                      {[ride.dropoff_postal_code, ride.dropoff_city]
                        .filter(Boolean)
                        .join(' ')}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex gap-8">
              <ModeBadge mode={ride.transport_mode} />
              <UrgencyBadge urgency={ride.urgency} />
            </section>

            <section className="space-y-8">
              <SectionTitle>Assignation</SectionTitle>
              {ride.driver ? (
                <div className="flex items-center gap-12">
                  <InitialsAvatar
                    name={ride.driver.nom_affichage}
                    role="chauffeur"
                    size={32}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {ride.driver.nom_affichage}
                    </div>
                    {ride.vehicle && (
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {ride.vehicle.immatriculation}
                        {ride.vehicle.marque && ride.vehicle.modele
                          ? ` · ${ride.vehicle.marque} ${ride.vehicle.modele}`
                          : ''}
                      </div>
                    )}
                  </div>
                  {ride.status === 'assignee' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onUnassign}
                      disabled={pending}
                    >
                      Désassigner
                    </Button>
                  )}
                </div>
              ) : ride.status === 'validee' ? (
                <Button
                  type="button"
                  onClick={() => onRequestAssign(ride.id)}
                  className="w-full"
                >
                  Assigner un chauffeur
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun chauffeur assigné.
                </p>
              )}
            </section>

            {(ride.started_at || ride.ended_at) && (
              <section className="space-y-8">
                <SectionTitle>Exécution</SectionTitle>
                <ul className="space-y-4 text-sm">
                  {ride.started_at && (
                    <li className="flex justify-between gap-12">
                      <span className="text-muted-foreground">Démarrée</span>
                      <span className="tabular-nums">
                        {formatRelativeFr(ride.started_at)}
                      </span>
                    </li>
                  )}
                  {ride.ended_at && (
                    <li className="flex justify-between gap-12">
                      <span className="text-muted-foreground">Terminée</span>
                      <span className="tabular-nums">
                        à {formatTimeFr(ride.ended_at)}
                      </span>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {ride.status === 'terminee' && (
              <section className="space-y-8">
                <SectionTitle>Paiement</SectionTitle>
                <div className="flex items-center justify-between gap-12">
                  <PaymentBadge
                    status={ride.payment_status}
                    amountEur={ride.tarif_amount_eur}
                  />
                  {ride.payment_status === 'a_encaisser' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setPayOpen(true)}
                    >
                      Marquer encaissé
                    </Button>
                  )}
                </div>
              </section>
            )}

            <section className="space-y-12">
              <SectionTitle>Historique</SectionTitle>
              {auditQuery.isPending ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <RideAuditTimeline entries={audit} />
              )}
            </section>
          </div>
        )}

        {ride && (
          <RidePaymentPopover
            rideId={ride.id}
            defaultAmountEur={ride.tarif_amount_eur ?? null}
            open={payOpen}
            onOpenChange={setPayOpen}
            onDone={() => void invalidate()}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
    {children}
  </h3>
);

const DrawerSkeleton = () => (
  <div className="space-y-24" aria-label="Chargement de la course">
    <Skeleton className="h-32 w-2/3" />
    <Skeleton className="h-48 w-full" />
    <Skeleton className="h-64 w-full" />
    <Skeleton className="h-64 w-full" />
  </div>
);
