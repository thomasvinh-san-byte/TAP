'use client';

import { useState } from 'react';
import { UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoShowModal } from './no-show-modal.client';

/**
 * Bouton "Patient absent" — visible uniquement quand `status = 'assignee'`
 * (avant départ chauffeur vers patient).
 *
 * Hauteur intentionnellement INVERSE des CTA primaires (h-12 au lieu de
 * h-14) : anti mis-tap DEC-014. Le chauffeur ne doit PAS pouvoir cliquer
 * "Patient absent" par erreur en visant "Démarrer la course".
 */
export function NoShowButton({ rideId }: { rideId: string }): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-12 w-full text-base"
      >
        <UserX aria-hidden className="mr-8 h-16 w-16" />
        Patient absent
      </Button>
      <NoShowModal rideId={rideId} open={open} onOpenChange={setOpen} />
    </>
  );
}
