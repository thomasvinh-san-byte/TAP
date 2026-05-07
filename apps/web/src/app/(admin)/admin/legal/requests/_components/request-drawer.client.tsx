'use client';

import { useState, useTransition } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createDataRequestAction } from '../actions';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Drawer création demande RGPD initiée par la régulatrice (D-09, D-10).
 */
export function RequestDrawer({ open, onOpenChange }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await createDataRequestAction(
        { error: undefined },
        formData,
      );
      if (res.error) setError(res.error);
      else onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:w-[400px] sm:max-w-[400px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Nouvelle demande RGPD</SheetTitle>
          <SheetDescription>
            Articles 15-21 RGPD — délai 30 jours
          </SheetDescription>
        </SheetHeader>

        <form action={onSubmit} className="space-y-16 mt-24">
          <div className="space-y-4">
            <Label htmlFor="patient_id">Patient (UUID, optionnel)</Label>
            <Input id="patient_id" name="patient_id" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="request_type">Type de demande</Label>
            <select
              id="request_type"
              name="request_type"
              required
              className="flex h-32 w-full rounded-md border border-input bg-background px-12 text-sm"
            >
              <option value="acces">Accès (art. 15)</option>
              <option value="rectification">Rectification (art. 16)</option>
              <option value="effacement">Effacement (art. 17)</option>
              <option value="limitation">Limitation (art. 18)</option>
              <option value="portabilite">Portabilité (art. 20)</option>
              <option value="opposition">Opposition (art. 21)</option>
            </select>
          </div>
          <div className="space-y-4">
            <Label htmlFor="requester_email">Email demandeur</Label>
            <Input
              id="requester_email"
              name="requester_email"
              type="email"
              placeholder="patient@email.fr"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-8 pt-16">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Créer'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
