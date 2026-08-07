import type { OptimizationProposal } from '@tap/optimizer-client';
import { IndicatorsBand } from './indicators-band';
import { ProposedGroupCard } from './proposed-group-card';
import { ExcludedRidesSection } from './excluded-rides-section';
import { RideBadge } from './ride-badge';
import { getGroupColor } from '../_lib/group-colors';
import type { GroupDecision, AdjustedGroupement } from '../_lib/use-optimization.client';

type CurrentRide = {
  id: string;
  scheduled_at: string;
  pickup_address?: string;
  dropoff_address?: string;
};

type VehicleOption = { id: string; label: string };
type DriverOption = { id: string; label: string };

type Props = {
  proposal: OptimizationProposal;
  currentRides: CurrentRide[];
  decisions: Map<string, GroupDecision>;
  availableVehicles: VehicleOption[];
  /** Chauffeurs actifs pour le sélecteur d'affectation par groupement. */
  availableDrivers: DriverOption[];
  /** Chauffeur choisi par groupement (clé = vehicle_id). */
  driverByGroupement: Map<string, string | null>;
  onSetDriver: (id: string, driverId: string | null) => void;
  /** Labels lisibles par UUID de course (Wave 4) — fournis par le Route Handler. */
  rideLabels?: Record<string, string>;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAdjust: (id: string, adjusted: AdjustedGroupement) => void;
};

/**
 * Vue comparative plan actuel / plan proposé (Surface 2).
 * Deux colonnes : liste plate des courses actuelles (gauche) + groupements proposés (droite).
 */
export function ComparativeView({
  proposal,
  currentRides,
  decisions,
  availableVehicles,
  availableDrivers,
  driverByGroupement,
  onSetDriver,
  rideLabels = {},
  onAccept,
  onReject,
  onAdjust,
}: Props): JSX.Element {
  const ridesNonGroupeesIds = new Set(proposal.ridesNonGroupeesIds);

  // Index véhicules par id pour résoudre le label affiché par carte.
  const vehiclesById = new Map(availableVehicles.map((v) => [v.id, v.label]));

  // Wave 2 Phase 06.11 — B9 : index ride → groupIndex pour pastilles cluster
  // dans la liste « Plan actuel » (colonne gauche).
  const rideToGroupIndex = new Map<string, number>();
  proposal.groupements.forEach((g, idx) => {
    g.ride_ids.forEach((rideId) => rideToGroupIndex.set(rideId, idx));
  });
  const rideAttributes = proposal.rideAttributes;

  return (
    <div className="space-y-24">
      <IndicatorsBand
        tauxMutualisation={proposal.tauxMutualisation}
        kmAVideEstimes={proposal.kmAVideEstimes}
      />

      <div className="grid grid-cols-1 gap-24 lg:grid-cols-2">
        {/* Panneau gauche — Plan actuel (lecture seule) */}
        <section aria-labelledby="plan-actuel-title">
          <h2
            id="plan-actuel-title"
            className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
          >
            Plan actuel
          </h2>
          <ol className="mt-12 space-y-4">
            {currentRides.map((ride, i) => {
              const groupIdx = rideToGroupIndex.get(ride.id);
              const color = groupIdx !== undefined ? getGroupColor(groupIdx) : null;
              const attrs = rideAttributes?.[ride.id];
              return (
                <li key={ride.id} className="flex flex-wrap items-center gap-4 text-sm">
                  <span>
                    {i + 1}.{' '}
                    {new Date(ride.scheduled_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {color && groupIdx !== undefined && (
                    <span
                      className={`inline-block h-8 w-8 shrink-0 rounded-full ${color.dot}`}
                      aria-label={`Appartient au groupement ${groupIdx + 1} (${color.label})`}
                      title={`Groupement ${groupIdx + 1}`}
                    />
                  )}
                  {ride.pickup_address && <span>· {ride.pickup_address}</span>}
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
        </section>

        {/* Panneau droit — Plan proposé */}
        <section
          aria-labelledby="plan-propose-title"
          aria-label="Plan proposé (affiché en premier sur petit écran)"
        >
          <h2
            id="plan-propose-title"
            className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
          >
            Plan proposé
          </h2>
          <div className="mt-12 space-y-16">
            {proposal.groupements.map((group, i) => {
              const rideCitycodes: (string | null)[] = [];
              return (
                <ProposedGroupCard
                  key={group.vehicle_id}
                  groupement={group}
                  groupIndex={i}
                  decision={decisions.get(group.vehicle_id) ?? 'idle'}
                  onAccept={() => onAccept(group.vehicle_id)}
                  onReject={() => onReject(group.vehicle_id)}
                  onAdjust={(adj) => onAdjust(group.vehicle_id, adj)}
                  availableVehicles={availableVehicles}
                  availableDrivers={availableDrivers}
                  selectedDriverId={driverByGroupement.get(group.vehicle_id) ?? null}
                  onDriverChange={(driverId) => onSetDriver(group.vehicle_id, driverId)}
                  rideLabels={rideLabels}
                  vehicleLabel={vehiclesById.get(group.vehicle_id)}
                  rideCitycodes={rideCitycodes}
                  rideAttributes={rideAttributes}
                />
              );
            })}

            {Array.from(ridesNonGroupeesIds).map((rideId) => (
              <div key={rideId} className="text-muted-foreground text-sm">
                {rideLabels[rideId] ?? `Course ${rideId.slice(0, 8)}`} : non groupée
              </div>
            ))}
          </div>
        </section>
      </div>

      <ExcludedRidesSection excludedRides={proposal.excludedRides} rideLabels={rideLabels} />
    </div>
  );
}
