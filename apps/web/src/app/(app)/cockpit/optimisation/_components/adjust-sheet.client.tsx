'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { Groupement } from '@tap/optimizer-client';
import type { AdjustedGroupement } from '../_lib/use-optimization.client';

type VehicleOption = { id: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupement: Groupement;
  groupIndex: number;
  availableVehicles: VehicleOption[];
  /** Labels lisibles par UUID de course (Wave 4) — utilisés sur les checkboxes. */
  rideLabels?: Record<string, string>;
  onConfirm: (adjusted: AdjustedGroupement) => void;
};

/**
 * Sheet latéral « Ajuster » pour un groupement (Surface 3bis).
 *
 * Aucune Server Action — état local uniquement (D-18).
 * Le Sheet met à jour l'état local de la proposition, pas la base.
 */
export function AdjustSheet({
  open,
  onOpenChange,
  groupement,
  groupIndex,
  availableVehicles,
  rideLabels = {},
  onConfirm,
}: Props): JSX.Element {
  const [selectedRides, setSelectedRides] = useState<Set<string>>(new Set(groupement.ride_ids));
  const [vehicleId, setVehicleId] = useState(groupement.vehicle_id);

  function toggleRide(id: string): void {
    setSelectedRides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleConfirm(): void {
    onConfirm({
      groupementId: groupement.vehicle_id,
      rideIds: Array.from(selectedRides),
      vehicleId,
    });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px]">
        <SheetHeader>
          <SheetTitle>Ajuster le groupement {groupIndex + 1}</SheetTitle>
        </SheetHeader>

        <div className="mt-16 space-y-16">
          <div>
            <p className="text-sm font-semibold">Courses à inclure</p>
            <ul className="mt-8 space-y-8">
              {groupement.ride_ids.map((rideId, i) => (
                <li key={rideId} className="flex items-center gap-8">
                  <Checkbox
                    id={`ride-${rideId}`}
                    checked={selectedRides.has(rideId)}
                    onChange={() => toggleRide(rideId)}
                  />
                  <label htmlFor={`ride-${rideId}`} className="text-sm">
                    {rideLabels[rideId] ?? `Course ${i + 1} (${rideId.slice(0, 8)})`}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <label htmlFor="vehicle-select" className="text-sm font-semibold">
              Véhicule suggéré
            </label>
            <select
              id="vehicle-select"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="border-input bg-background mt-8 w-full rounded-md border px-8 py-8 text-sm"
            >
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <SheetFooter className="mt-24">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abandonner les modifications
          </Button>
          <Button variant="accent" onClick={handleConfirm}>
            Valider l&apos;ajustement
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
