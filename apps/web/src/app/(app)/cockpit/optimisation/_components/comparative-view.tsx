import type { OptimizationProposal } from '@tap/optimizer-client';
import { IndicatorsBand } from './indicators-band';
import { ProposedGroupCard } from './proposed-group-card';
import { ExcludedRidesSection } from './excluded-rides-section';
import type { GroupDecision, AdjustedGroupement } from '../_lib/use-optimization.client';

type CurrentRide = {
  id: string;
  scheduled_at: string;
  pickup_address?: string;
  dropoff_address?: string;
};

type VehicleOption = { id: string; label: string };

type Props = {
  proposal: OptimizationProposal;
  currentRides: CurrentRide[];
  decisions: Map<string, GroupDecision>;
  availableVehicles: VehicleOption[];
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
  onAccept,
  onReject,
  onAdjust,
}: Props): JSX.Element {
  const ridesNonGroupeesIds = new Set(proposal.ridesNonGroupeesIds);

  return (
    <div className="space-y-24">
      <IndicatorsBand
        tauxMutualisation={proposal.tauxMutualisation}
        kmAVideEstimes={proposal.kmAVideEstimes}
      />

      <div className="grid grid-cols-1 gap-24 lg:grid-cols-2">
        {/* Panneau gauche — Plan actuel (lecture seule) */}
        <section aria-labelledby="plan-actuel-title">
          <h2 id="plan-actuel-title" className="text-base font-semibold">
            Plan actuel
          </h2>
          <ol className="mt-8 space-y-4">
            {currentRides.map((ride, i) => (
              <li key={ride.id} className="text-sm">
                {i + 1}.{' '}
                {new Date(ride.scheduled_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                {ride.pickup_address ? `— ${ride.pickup_address}` : ''}
              </li>
            ))}
          </ol>
        </section>

        {/* Panneau droit — Plan proposé */}
        <section
          aria-labelledby="plan-propose-title"
          aria-label="Plan proposé — affiché en premier sur petit écran"
        >
          <h2 id="plan-propose-title" className="text-base font-semibold">
            Plan proposé
          </h2>
          <div className="mt-8 space-y-16">
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
                  rideCitycodes={rideCitycodes}
                />
              );
            })}

            {Array.from(ridesNonGroupeesIds).map((rideId) => (
              <div key={rideId} className="text-muted-foreground text-sm">
                Course {rideId.slice(0, 8)} — non groupée
              </div>
            ))}
          </div>
        </section>
      </div>

      <ExcludedRidesSection excludedRides={proposal.excludedRides} />
    </div>
  );
}
