'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { assignRideAction } from '@/app/(app)/courses/actions';
import type { Groupement } from '@tap/optimizer-client';
import type { AdjustedGroupement } from '../_lib/use-optimization.client';

type Props = {
  open: boolean;
  onCancel: () => void;
  acceptedGroupements: Groupement[];
  adjustments: Map<string, AdjustedGroupement>;
  /** Chauffeur choisi par groupement (clé = vehicle_id) — suggéré puis validé. */
  driverByGroupement: Map<string, string | null>;
};

/**
 * Modale de confirmation de l'application des groupements acceptés (D-14/D-16).
 *
 * Affecte CHAUFFEUR + véhicule via `assignRideAction` (transition validée →
 * affectée, machine à états + compare-and-set + traçabilité). Un groupement sans
 * chauffeur choisi reste NON affecté (signalé, pas d'affectation à vide). Échec
 * partiel géré honnêtement. Toast Sonner — jamais alert() natif.
 */
export function ApplyConfirmationDialog({
  open,
  onCancel,
  acceptedGroupements,
  adjustments,
  driverByGroupement,
}: Props): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const count = acceptedGroupements.length;

  function handleApply(): void {
    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;
      let unassignedGroups = 0;

      for (const group of acceptedGroupements) {
        const adj = adjustments.get(group.vehicle_id);
        const rideIds = adj ? adj.rideIds : group.ride_ids;
        const vehicleId = adj ? adj.vehicleId : group.vehicle_id;
        const driverId = driverByGroupement.get(group.vehicle_id) ?? null;

        // Aucun chauffeur disponible/choisi → on ne l'affecte PAS à vide : le
        // groupement reste non affecté et sera signalé (course non affectée).
        if (!driverId) {
          unassignedGroups++;
          continue;
        }

        for (const rideId of rideIds) {
          const res = await assignRideAction({ rideId, driverId, vehicleId });
          if (res.error) {
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      // Échec DUR (une affectation a échoué) : rester honnête — informer,
      // rafraîchir sur place, NE PAS rediriger comme si tout avait réussi.
      if (errorCount > 0) {
        toast.error(
          `${successCount} course(s) affectée(s), ${errorCount} erreur(s)` +
            (unassignedGroups > 0 ? `, ${unassignedGroups} sans chauffeur` : '') +
            '.',
        );
        router.refresh();
        onCancel();
        return;
      }

      // Succès : les courses sont réellement affectées (statut « affectée »). On
      // ferme la boucle → retour au cockpit. Les groupements sans chauffeur
      // disponible restent non affectés (signalés au cockpit) : on le dit.
      const suffix =
        unassignedGroups > 0
          ? ` ${unassignedGroups} groupement(s) sans chauffeur disponible, à affecter manuellement.`
          : '';
      toast.success(`${successCount} course(s) affectée(s). Retour au cockpit.${suffix}`, {
        id: 'sonner-toast',
      });
      onCancel();
      router.push('/cockpit?optimise=applied');
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !pending) onCancel();
      }}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Appliquer les groupements acceptés ?</DialogTitle>
          <DialogDescription>
            {count} groupement(s) accepté(s) : chaque course sera affectée à son chauffeur et à son
            véhicule (statut « affectée »). Un groupement sans chauffeur disponible restera non
            affecté. Réversible depuis la liste des courses.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Revenir à la proposition
          </Button>
          <Button
            type="submit"
            variant="accent"
            onClick={handleApply}
            disabled={pending}
            aria-busy={pending}
            data-testid="confirm-apply-btn"
          >
            {pending ? 'Application en cours…' : 'Appliquer les groupements'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
