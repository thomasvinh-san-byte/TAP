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
import { createDataProcessingRegisterAction } from '../actions';
import { RegistreFields } from './registre-fields.client';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Drawer création entrée registre (D-05). Largeur 400px (cf. patient-drawer).
 * Pas de mode édition (D-05 versioning par lignes — créer une nouvelle entrée).
 */
export function RegistreDrawer({ open, onOpenChange }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await createDataProcessingRegisterAction({ error: undefined }, formData);
      if (res.error) setError(res.error);
      else onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] overflow-y-auto sm:w-[400px] sm:max-w-[400px]"
      >
        <SheetHeader>
          <SheetTitle>Nouvelle entrée registre</SheetTitle>
          <SheetDescription>
            Article 30 RGPD : chaque enregistrement crée une nouvelle version.
          </SheetDescription>
        </SheetHeader>

        <form action={onSubmit} className="mt-24 space-y-16">
          <RegistreFields />

          {error && <p className="text-destructive text-sm">{error}</p>}

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
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
