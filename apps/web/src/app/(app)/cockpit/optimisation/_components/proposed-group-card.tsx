'use client';

import { useState } from 'react';
import { Check, X, SlidersHorizontal, CheckCircle, Car, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HautsBadge } from './hauts-badge';
import { RideBadge } from './ride-badge';
import { AdjustSheet } from './adjust-sheet.client';
import { groupTraverseHauts } from '../_lib/hauts-citycodes';
import { getGroupColor } from '../_lib/group-colors';
import type { Groupement, RideAttributes } from '@tap/optimizer-client';
import type { AdjustedGroupement } from '../_lib/use-optimization.client';

type GroupDecision = 'idle' | 'accepted' | 'rejected';

type VehicleOption = { id: string; label: string };
type DriverOption = { id: string; label: string };

type Props = {
  groupement: Groupement;
  groupIndex: number;
  decision: GroupDecision;
  onAccept: () => void;
  onReject: () => void;
  onAdjust: (adjusted: AdjustedGroupement) => void;
  availableVehicles: VehicleOption[];
  /** Chauffeurs actifs disponibles pour l'affectation de ce groupement. */
  availableDrivers: DriverOption[];
  /** Chauffeur actuellement choisi (suggéré puis modifiable), `null` si aucun. */
  selectedDriverId: string | null;
  onDriverChange: (driverId: string | null) => void;
  /** Labels lisibles par UUID de course (Wave 4) — heure + ville → ville + initiales. */
  rideLabels?: Record<string, string>;
  /** Label du véhicule de ce groupement (Wave 4) — immatriculation + type. */
  vehicleLabel?: string;
  /** Citycodes de toutes les courses du groupement pour détection Hauts. */
  rideCitycodes: (string | null)[];
  /** Attributs métier par UUID de course pour badges (Wave 2 Phase 06.11 — B3). */
  rideAttributes?: Record<string, RideAttributes>;
};

/**
 * Carte d'un groupement proposé (Surface 3).
 * 3 actions : Accepter / Rejeter / Ajuster (D-15, grain fin).
 * État accept/reject éphémère (D-18).
 */
export function ProposedGroupCard({
  groupement,
  groupIndex,
  decision,
  onAccept,
  onReject,
  onAdjust,
  availableVehicles,
  availableDrivers,
  selectedDriverId,
  onDriverChange,
  rideLabels = {},
  vehicleLabel,
  rideCitycodes,
  rideAttributes,
}: Props): JSX.Element {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const isHauts = groupTraverseHauts(rideCitycodes);

  // Wave 2 Phase 06.11 — B9 : couleur d'identification du groupement.
  // Override par accepted/rejected qui restent prioritaires visuellement.
  const groupColor = getGroupColor(groupIndex);
  const borderClass =
    decision === 'accepted'
      ? 'border-l-4 border-l-green-500'
      : decision === 'rejected'
        ? 'border-l-4 border-l-destructive'
        : `border-l-4 ${groupColor.border}`;

  return (
    <article
      className={`bg-muted/40 rounded-lg border p-16 shadow-sm transition-shadow duration-150 hover:shadow-md ${borderClass}`}
      data-testid="proposed-group-card"
      data-state={decision}
    >
      <div className="flex items-start justify-between gap-8">
        <h3 className="flex items-center gap-8 text-sm font-semibold">
          <span
            className={`inline-block h-12 w-12 shrink-0 rounded-full ${groupColor.dot}`}
            aria-label={`Identifiant visuel du groupement : ${groupColor.label}`}
          />
          Groupement {groupIndex + 1}
          {groupement.ride_ids.length > 2 && ` (${groupement.ride_ids.length} courses)`}
        </h3>
        <div className="flex items-center gap-8">
          {isHauts && <HautsBadge />}
          {decision === 'accepted' && (
            <CheckCircle className="h-16 w-16 text-green-600" aria-label="Accepté" />
          )}
        </div>
      </div>

      <ol className="mt-8 space-y-4">
        {groupement.order.map((rideId, i) => {
          const attrs = rideAttributes?.[rideId];
          return (
            <li key={rideId} className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                {i + 1}. {rideLabels[rideId] ?? `Course ${rideId.slice(0, 8)}`}
              </span>
              {attrs && (
                <span className="ml-4 inline-flex flex-wrap gap-4">
                  <RideBadge type="transport" value={attrs.transport_mode} />
                  {attrs.urgency !== 'programmee' && (
                    <RideBadge type="urgency" value={attrs.urgency} />
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-8 flex items-center gap-8 text-sm">
        <Car className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <span className="text-muted-foreground">
          Véhicule suggéré : {vehicleLabel ?? groupement.vehicle_id.slice(0, 8)}
        </span>
      </div>

      {/* Chauffeur suggéré + validation humaine : le régulateur voit la suggestion
          et peut en choisir un autre avant d'appliquer (garde-fou transport de
          patients). « Aucun » = groupement laissé non affecté. */}
      <div className="mt-8 flex items-center gap-8 text-sm">
        <User className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <label htmlFor={`driver-${groupement.vehicle_id}`} className="text-muted-foreground">
          Chauffeur :
        </label>
        <select
          id={`driver-${groupement.vehicle_id}`}
          className="border-input bg-background min-h-[36px] rounded-md border px-8 py-4 text-sm"
          value={selectedDriverId ?? ''}
          onChange={(e) => onDriverChange(e.target.value === '' ? null : e.target.value)}
        >
          <option value="">Aucun (non affecté)</option>
          {availableDrivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        {selectedDriverId === null && (
          <span className="text-warning text-xs">Ce groupement ne sera pas affecté.</span>
        )}
      </div>

      {groupement.motif && (
        <p className="text-muted-foreground mt-4 text-sm">Motif : {groupement.motif}</p>
      )}
      <p className="text-muted-foreground mt-4 text-sm">
        Gain estimé : ~{Math.round(groupement.gain_km_a_vide)} km à vide
      </p>

      <div className="mt-12 flex gap-8">
        <Button
          size="sm"
          variant="default"
          className="min-h-[44px] flex-1"
          onClick={onAccept}
          disabled={decision === 'accepted'}
          data-testid={`group-${groupIndex}-accept`}
          aria-label={`Accepter le groupement ${groupIndex + 1}`}
        >
          <Check className="mr-4 h-16 w-16" aria-hidden />
          Accepter
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/40 text-destructive min-h-[44px] flex-1"
          onClick={onReject}
          disabled={decision === 'rejected'}
          aria-label={`Rejeter le groupement ${groupIndex + 1}`}
        >
          <X className="mr-4 h-16 w-16" aria-hidden />
          Rejeter
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px] flex-1"
          onClick={() => setAdjustOpen(true)}
          aria-label={`Ajuster le groupement ${groupIndex + 1}`}
        >
          <SlidersHorizontal className="mr-4 h-16 w-16" aria-hidden />
          Ajuster
        </Button>
      </div>

      <AdjustSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        groupement={groupement}
        groupIndex={groupIndex}
        availableVehicles={availableVehicles}
        rideLabels={rideLabels}
        onConfirm={onAdjust}
      />
    </article>
  );
}
