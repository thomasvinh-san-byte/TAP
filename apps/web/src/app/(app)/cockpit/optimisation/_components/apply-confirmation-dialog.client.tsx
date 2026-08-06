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
import { assignVehicleAction } from '@/app/(app)/courses/actions';
import type { Groupement } from '@tap/optimizer-client';
import type { AdjustedGroupement } from '../_lib/use-optimization.client';

type Props = {
  open: boolean;
  onCancel: () => void;
  acceptedGroupements: Groupement[];
  adjustments: Map<string, AdjustedGroupement>;
};

/**
 * Modale de confirmation de l'application des groupements acceptés (D-14/D-16).
 *
 * Appelle assignVehicleAction pour chaque course des groupements acceptés.
 * Toast Sonner de succès — jamais alert() natif.
 */
export function ApplyConfirmationDialog({
  open,
  onCancel,
  acceptedGroupements,
  adjustments,
}: Props): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const count = acceptedGroupements.length;

  function handleApply(): void {
    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;

      for (const group of acceptedGroupements) {
        const adj = adjustments.get(group.vehicle_id);
        const rideIds = adj ? adj.rideIds : group.ride_ids;
        const vehicleId = adj ? adj.vehicleId : group.vehicle_id;

        for (const rideId of rideIds) {
          const res = await assignVehicleAction({ rideId, vehicleId });
          if (res.error) {
            errorCount++;
          } else {
            successCount++;
          }
        }
      }

      // Échec partiel : rester honnête — on informe, on rafraîchit sur place, on
      // NE redirige PAS (ne pas laisser croire que tout a réussi).
      if (errorCount > 0) {
        toast.error(`${successCount} course(s) enregistrée(s), ${errorCount} erreur(s).`);
        router.refresh();
        onCancel();
        return;
      }
      // Succès complet : fermer la boucle — retour au cockpit pour VOIR l'effet.
      // `assignVehicleAction` a déjà revalidé /cockpit ; `push` récupère les
      // données à jour. Le repère `?optimise=applied` affiche un bandeau discret.
      toast.success(`${count} groupement(s) appliqué(s). Retour au cockpit.`, {
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
            {count} groupement(s) accepté(s) seront enregistrés. Cette action reste réversible
            depuis la liste des courses.
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
