'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  assignRideAction,
  listActiveDriversAction,
  listActiveVehiclesAction,
} from '../actions';
import type { DriverMin, VehicleMin } from '../_lib/queries';

interface Props {
  rideId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Modal d'assignation chauffeur + véhicule (Phase 3 / 03-D).
 *
 * - Liste drivers actifs + recherche fuzzy locale (drivers ≤ 50, suffisant
 *   pour la Passe 1)
 * - Véhicule optionnel — pas de couplage type_permis ↔ vehicle.type V1
 *   (Q ouverte côté brief, on garde permissif)
 * - Cmd+Entrée submit
 * - Server Action assignRideAction → revalidatePath('/courses') déjà côté
 *   action — on invalide tout de même côté client pour le drawer + liste.
 */
export function AssignModal({
  rideId,
  open,
  onOpenChange,
}: Props): JSX.Element {
  const qc = useQueryClient();
  const [query, setQuery] = React.useState('');
  const [selectedDriverId, setSelectedDriverId] = React.useState<string | null>(
    null,
  );
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(
    null,
  );
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedDriverId(null);
      setSelectedVehicleId(null);
    }
  }, [open]);

  const driversQuery = useQuery({
    queryKey: ['drivers-active'],
    queryFn: () => listActiveDriversAction(),
    enabled: open,
    staleTime: 60_000,
  });
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles-active'],
    queryFn: () => listActiveVehiclesAction(),
    enabled: open,
    staleTime: 60_000,
  });

  const drivers = (driversQuery.data ?? []) as DriverMin[];
  const vehicles = (vehiclesQuery.data ?? []) as VehicleMin[];
  const nq = normalize(query.trim());
  const filteredDrivers = nq
    ? drivers.filter((d) => normalize(d.nom_affichage).includes(nq))
    : drivers;

  const submit = React.useCallback(async () => {
    if (!rideId || !selectedDriverId) return;
    setPending(true);
    const res = await assignRideAction({
      rideId,
      driverId: selectedDriverId,
      vehicleId: selectedVehicleId ?? undefined,
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Course affectée.');
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['rides'] }),
      qc.invalidateQueries({ queryKey: ['ride', rideId] }),
      qc.invalidateQueries({ queryKey: ['ride-audit', rideId] }),
    ]);
    onOpenChange(false);
  }, [qc, onOpenChange, rideId, selectedDriverId, selectedVehicleId]);

  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        onKeyDown={onKey}
      >
        <DialogHeader>
          <DialogTitle>Affecter un chauffeur</DialogTitle>
          <DialogDescription>
            Choisir un chauffeur actif et, optionnellement, un véhicule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-16">
          <div className="relative">
            <Search
              className="absolute left-12 top-1/2 -translate-y-1/2 h-16 w-16 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un chauffeur…"
              aria-label="Rechercher un chauffeur"
              className="pl-32"
              autoFocus
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-md border border-border">
            {driversQuery.isPending ? (
              <div className="p-12 space-y-8">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : filteredDrivers.length === 0 ? (
              <p className="p-16 text-sm text-muted-foreground">
                Aucun chauffeur actif trouvé.
              </p>
            ) : (
              <ul role="listbox" aria-label="Chauffeurs disponibles">
                {filteredDrivers.map((d) => {
                  const active = d.id === selectedDriverId;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => setSelectedDriverId(d.id)}
                        className={cn(
                          'flex w-full items-center gap-12 px-12 py-8 text-left transition-colors duration-150',
                          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                          active && 'bg-primary/10',
                        )}
                      >
                        <InitialsAvatar
                          name={d.nom_affichage}
                          role="chauffeur"
                          size={24}
                        />
                        <span className="flex-1 min-w-0 truncate text-sm">
                          {d.nom_affichage}
                        </span>
                        <span className="flex gap-4">
                          {(d.type_permis ?? []).map((t) => (
                            <span
                              key={t}
                              className="rounded-md border border-border bg-muted px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-8">
              Véhicule (optionnel)
            </div>
            <div className="max-h-[160px] overflow-y-auto rounded-md border border-border">
              {vehiclesQuery.isPending ? (
                <Skeleton className="h-32 w-full m-12" />
              ) : vehicles.length === 0 ? (
                <p className="p-16 text-sm text-muted-foreground">
                  Aucun véhicule actif.
                </p>
              ) : (
                <ul role="listbox" aria-label="Véhicules disponibles">
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleId(null)}
                      className={cn(
                        'flex w-full items-center gap-12 px-12 py-8 text-left text-sm transition-colors duration-150',
                        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                        selectedVehicleId === null && 'bg-primary/10',
                      )}
                    >
                      <span className="text-muted-foreground">
                        Aucun véhicule
                      </span>
                    </button>
                  </li>
                  {vehicles.map((v) => {
                    const active = v.id === selectedVehicleId;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedVehicleId(v.id)}
                          className={cn(
                            'flex w-full items-center gap-12 px-12 py-8 text-left text-sm transition-colors duration-150',
                            'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                            active && 'bg-primary/10',
                          )}
                        >
                          <span className="font-medium tabular-nums">
                            {v.immatriculation}
                          </span>
                          <span className="text-muted-foreground truncate">
                            {[v.marque, v.modele].filter(Boolean).join(' ')}
                          </span>
                          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                            {v.type}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!selectedDriverId || pending}
          >
            Assigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
