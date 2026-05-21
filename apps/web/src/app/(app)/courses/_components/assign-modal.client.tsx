'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CarTaxiFront, Search } from 'lucide-react';
import { isCompatible } from '@tap/shared';
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
import { assignRideAction, listActiveDriversAction, listActiveVehiclesAction } from '../actions';
import type { DriverMin, VehicleMin } from '../_lib/queries';

interface Props {
  rideId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Modal d'assignation chauffeur + véhicule (Phase 3 / 03-D).
 *
 * - Liste drivers actifs + recherche fuzzy locale (drivers ≤ 50, suffisant
 *   pour la Passe 1)
 * - Filtre permis ↔ véhicule (DEC-038) : si un véhicule est sélectionné,
 *   filtrer par compatibilité. Toolbar pills « Compatibles / Afficher tous »
 *   permet à la régulatrice de basculer en mode urgence (DEC-029 esprit
 *   pragmatique). Badge sémantique par ligne + warning bloc si sélection
 *   incompatible.
 * - Cmd+Entrée submit
 * - Server Action assignRideAction → revalidatePath('/courses') déjà côté
 *   action — on invalide tout de même côté client pour le drawer + liste.
 */
export function AssignModal({ rideId, open, onOpenChange }: Props): JSX.Element {
  const qc = useQueryClient();
  const [query, setQuery] = React.useState('');
  const [selectedDriverId, setSelectedDriverId] = React.useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string | null>(null);
  const [showCompatibleOnly, setShowCompatibleOnly] = React.useState(true);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedDriverId(null);
      setSelectedVehicleId(null);
      setShowCompatibleOnly(true);
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
  const selectedVehicle = React.useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  );
  const selectedDriver = React.useMemo(
    () => drivers.find((d) => d.id === selectedDriverId) ?? null,
    [drivers, selectedDriverId],
  );
  const nq = normalize(query.trim());

  // Filtre par recherche + compatibilité permis/véhicule (DEC-038).
  // - sans véhicule sélectionné : pas de filtre compat, juste la recherche
  // - avec véhicule + showCompatibleOnly=true : ne garde que les compatibles
  // - avec véhicule + showCompatibleOnly=false : compatibles d'abord (tri),
  //   incompatibles ensuite avec badge destructive
  const filteredDrivers = React.useMemo(() => {
    const matched = nq ? drivers.filter((d) => normalize(d.nom_affichage).includes(nq)) : drivers;
    if (!selectedVehicle) {
      return matched.map((d) => ({ ...d, compatible: true as const }));
    }
    const withCompat = matched.map((d) => ({
      ...d,
      compatible: isCompatible({ driver: d, vehicle: selectedVehicle }),
    }));
    if (showCompatibleOnly) {
      return withCompat.filter((d) => d.compatible);
    }
    return [...withCompat].sort((a, b) => {
      if (a.compatible !== b.compatible) return a.compatible ? -1 : 1;
      return a.nom_affichage.localeCompare(b.nom_affichage, 'fr');
    });
  }, [drivers, nq, selectedVehicle, showCompatibleOnly]);

  const selectedIncompatible =
    selectedDriver !== null &&
    selectedVehicle !== null &&
    !isCompatible({ driver: selectedDriver, vehicle: selectedVehicle });

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
      <DialogContent className="max-w-lg" onKeyDown={onKey}>
        <DialogHeader>
          <DialogTitle>Affecter un chauffeur</DialogTitle>
          <DialogDescription>
            Choisir un chauffeur actif et, optionnellement, un véhicule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-16">
          <div className="relative">
            <Search
              className="text-muted-foreground absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2"
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

          {selectedVehicle && (
            <div
              className="border-border bg-muted/40 inline-flex rounded-md border p-2"
              role="tablist"
              aria-label="Filtre de compatibilité"
            >
              <button
                type="button"
                role="tab"
                aria-selected={showCompatibleOnly}
                onClick={() => setShowCompatibleOnly(true)}
                className={cn(
                  'rounded-sm px-12 py-6 text-sm transition-colors',
                  showCompatibleOnly
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Compatibles
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!showCompatibleOnly}
                onClick={() => setShowCompatibleOnly(false)}
                className={cn(
                  'rounded-sm px-12 py-6 text-sm transition-colors',
                  !showCompatibleOnly
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Afficher tous
              </button>
            </div>
          )}

          <div className="border-border max-h-[280px] overflow-y-auto rounded-md border">
            {driversQuery.isPending ? (
              <div className="space-y-8 p-12">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : filteredDrivers.length === 0 ? (
              selectedVehicle && showCompatibleOnly ? (
                <div className="flex flex-col items-center justify-center px-16 py-48 text-center">
                  <CarTaxiFront className="text-muted-foreground mb-12 h-32 w-32" aria-hidden />
                  <p className="text-sm font-medium">
                    Aucun chauffeur compatible avec un véhicule {selectedVehicle.type}.
                  </p>
                  <p className="text-muted-foreground mt-8 text-xs">
                    Activez « Afficher tous » pour basculer en mode urgence.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-16"
                    onClick={() => setShowCompatibleOnly(false)}
                  >
                    Afficher tous
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground p-16 text-sm">Aucun chauffeur actif trouvé.</p>
              )
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
                          'hover:bg-muted/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                          active && 'bg-primary/10',
                        )}
                      >
                        <InitialsAvatar name={d.nom_affichage} role="chauffeur" size={24} />
                        <span className="min-w-0 flex-1 truncate text-sm">{d.nom_affichage}</span>
                        {selectedVehicle ? (
                          <span
                            className={cn(
                              'rounded-md border px-8 py-2 text-[11px] font-medium',
                              d.compatible
                                ? 'border-success/30 bg-success/10 text-success'
                                : 'border-destructive bg-background text-destructive',
                            )}
                          >
                            {d.compatible ? 'Compatible' : 'Incompatible'}
                          </span>
                        ) : (
                          <span className="flex gap-4">
                            {(d.type_permis ?? []).map((t) => (
                              <span
                                key={t}
                                className="border-border bg-muted text-muted-foreground rounded-md border px-4 py-2 text-[10px] uppercase tracking-wide"
                              >
                                {t}
                              </span>
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {selectedIncompatible && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-warning/10 border-warning/30 flex items-start gap-12 rounded-md border px-16 py-12"
            >
              <AlertTriangle className="text-warning mt-2 h-16 w-16 shrink-0" aria-hidden />
              <p className="text-foreground text-sm">
                Ce chauffeur n'a pas le permis requis pour ce véhicule. Confirmez en connaissance de
                cause.
              </p>
            </div>
          )}

          <div>
            <div className="text-muted-foreground mb-8 text-xs font-semibold uppercase tracking-wide">
              Véhicule (optionnel)
            </div>
            <div className="border-border max-h-[160px] overflow-y-auto rounded-md border">
              {vehiclesQuery.isPending ? (
                <Skeleton className="m-12 h-32 w-full" />
              ) : vehicles.length === 0 ? (
                <p className="text-muted-foreground p-16 text-sm">Aucun véhicule actif.</p>
              ) : (
                <ul role="listbox" aria-label="Véhicules disponibles">
                  <li>
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleId(null)}
                      className={cn(
                        'flex w-full items-center gap-12 px-12 py-8 text-left text-sm transition-colors duration-150',
                        'hover:bg-muted/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                        selectedVehicleId === null && 'bg-primary/10',
                      )}
                    >
                      <span className="text-muted-foreground">Aucun véhicule</span>
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
                            'hover:bg-muted/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                            active && 'bg-primary/10',
                          )}
                        >
                          <span className="font-medium tabular-nums">{v.immatriculation}</span>
                          <span className="text-muted-foreground truncate">
                            {[v.marque, v.modele].filter(Boolean).join(' ')}
                          </span>
                          <span className="text-muted-foreground ml-auto text-[10px] uppercase tracking-wide">
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
