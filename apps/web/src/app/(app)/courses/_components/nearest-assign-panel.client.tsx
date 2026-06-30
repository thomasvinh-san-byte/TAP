'use client';

import * as React from 'react';
import { MapPin, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { assignRideAction, proposeNearestDriversAction, type NearestProposal } from '../actions';

/**
 * EXPRESS-03 (§5.14) — « affecter au plus proche disponible ».
 *
 * Affiché après création d'une course express. Propose le classement des
 * chauffeurs actifs (proximité + charge, via proposeReassignments) : le meilleur
 * en tête, les alternatives dessous. Un clic affecte via `assignRideAction`
 * (même chemin que l'affectation manuelle). AIDE, pas automatisme : le régulateur
 * peut choisir une alternative ou simplement fermer (affectation manuelle plus
 * tard). Pas d'ETA (hors périmètre, dépend du HDS).
 */
function distanceLabel(distanceKm: number | null): string {
  if (distanceKm === null) return 'distance inconnue';
  return `~${distanceKm.toFixed(1)} km`;
}

export function NearestAssignPanel({
  rideId,
  onDone,
}: {
  rideId: string;
  onDone: () => void;
}): JSX.Element {
  const [proposal, setProposal] = React.useState<NearestProposal | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [assigningId, setAssigningId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void proposeNearestDriversAction(rideId).then((res) => {
      if (cancelled) return;
      if (res.error) toast.error(res.error);
      setProposal(res.data ?? { best: null, candidates: [], reassignable: false });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  async function assign(driverId: string): Promise<void> {
    setAssigningId(driverId);
    const res = await assignRideAction({ rideId, driverId });
    setAssigningId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Course affectée.');
    onDone();
  }

  return (
    <div className="space-y-12">
      <p className="text-muted-foreground text-sm">
        Course créée. Affecter au chauffeur le plus proche disponible (proximité et charge) ?
      </p>

      {loading ? (
        <div className="space-y-8">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !proposal || proposal.candidates.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-16 text-center text-sm">
          Aucun chauffeur disponible compatible.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {proposal.candidates.map((c, idx) => {
            const isBest = idx === 0;
            return (
              <li key={c.driverId}>
                <button
                  type="button"
                  onClick={() => void assign(c.driverId)}
                  disabled={assigningId !== null}
                  className={cn(
                    'flex w-full items-center gap-12 px-12 py-12 text-left transition-colors',
                    'hover:bg-muted/50 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
                    isBest && 'bg-success/5',
                    assigningId !== null && 'opacity-60',
                  )}
                >
                  <InitialsAvatar name={c.driverLabel} role="chauffeur" size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-8 text-sm font-medium">
                      <span className="truncate">{c.driverLabel}</span>
                      {isBest && (
                        <span className="border-success/30 bg-success/10 text-success inline-flex items-center gap-4 rounded-md border px-8 py-2 text-[11px] font-medium">
                          <Star className="h-12 w-12 shrink-0" aria-hidden />
                          Recommandé
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-2 flex items-center gap-8 text-xs tabular-nums">
                      <MapPin className="h-12 w-12 shrink-0" aria-hidden />
                      {distanceLabel(c.distanceKm)} · {c.load} course{c.load > 1 ? 's' : ''} ce jour
                    </div>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {assigningId === c.driverId ? 'Affectation…' : 'Affecter'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={assigningId !== null}>
          Affecter plus tard
        </Button>
      </div>
    </div>
  );
}
