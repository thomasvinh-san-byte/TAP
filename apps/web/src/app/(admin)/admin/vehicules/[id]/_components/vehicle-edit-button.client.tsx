'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { archiveVehicleAction } from '../../actions';
import type { VehicleRow } from '../../page';
import { VehicleForm } from '../../_components/vehicle-form.client';

/**
 * Bouton « Modifier » de la fiche véhicule — RÉUTILISE le `VehicleForm` existant
 * dans un panneau latéral (même composant que la liste). Archivage via l'action
 * existante `archiveVehicleAction` (confirmation), puis retour à la liste.
 */
export function VehicleEditButton({
  vehicle,
  uploadEnabled,
}: {
  vehicle: VehicleRow;
  uploadEnabled: boolean;
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);

  async function onArchive(): Promise<void> {
    const res = await archiveVehicleAction(vehicle.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Véhicule archivé.');
    setConfirmArchive(false);
    setOpen(false);
    router.push('/admin/vehicules');
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="mr-8 h-16 w-16" aria-hidden />
        Modifier
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-[480px] flex-col gap-0 p-0 sm:w-[480px] sm:max-w-[480px]"
        >
          <SheetHeader className="border-border shrink-0 border-b px-24 py-16 text-left">
            <SheetTitle>Modifier le véhicule</SheetTitle>
            <SheetDescription>
              Visible dans la fenêtre d&apos;affectation de course.
            </SheetDescription>
          </SheetHeader>
          <VehicleForm
            initial={vehicle}
            uploadEnabled={uploadEnabled}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
            onCancel={() => setOpen(false)}
            onArchive={() => setConfirmArchive(true)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={confirmArchive} onOpenChange={setConfirmArchive}>
        <SheetContent side="bottom" className="space-y-16 p-24">
          <SheetHeader>
            <SheetTitle>Archiver « {vehicle.immatriculation} » ?</SheetTitle>
            <SheetDescription>
              Le véhicule n&apos;apparaîtra plus dans la fenêtre d&apos;affectation. Les courses
              passées restent intactes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex justify-end gap-12">
            <Button type="button" variant="outline" onClick={() => setConfirmArchive(false)}>
              Annuler
            </Button>
            <Button type="button" variant="destructive" onClick={onArchive}>
              Archiver
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
