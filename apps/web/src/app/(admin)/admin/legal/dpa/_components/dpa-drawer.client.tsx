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
import { DateFieldFr } from '@/components/date-field-fr.client';
import { createDpaRecordAction } from '../actions';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Drawer création DPA (D-06). Largeur 400px.
 * Champs : sous-traitant, rôle, version, dates, URL document, notes.
 */
export function DpaDrawer({ open, onOpenChange }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await createDpaRecordAction({ error: undefined }, formData);
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
          <SheetTitle>Nouveau DPA sous-traitant</SheetTitle>
          <SheetDescription>Article 28 RGPD</SheetDescription>
        </SheetHeader>

        <form action={onSubmit} className="mt-24 space-y-16">
          <div className="space-y-4">
            <Label htmlFor="subprocessor_name">Sous-traitant</Label>
            <Input
              id="subprocessor_name"
              name="subprocessor_name"
              required
              placeholder="Supabase"
            />
          </div>
          <div className="space-y-4">
            <Label htmlFor="subprocessor_role">Rôle</Label>
            <Input
              id="subprocessor_role"
              name="subprocessor_role"
              required
              placeholder="hebergement"
            />
          </div>
          <div className="space-y-4">
            <Label htmlFor="dpa_version">Version DPA</Label>
            <Input id="dpa_version" name="dpa_version" required placeholder="v2025-01-15" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="dpa_document_url">URL document (optionnel)</Label>
            <Input id="dpa_document_url" name="dpa_document_url" type="url" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="signed_at">Signé le</Label>
            <DateFieldFr id="signed_at" name="signed_at" required />
          </div>
          <div className="space-y-4">
            <Label htmlFor="expires_at">Expire le (vide = évergreen)</Label>
            <DateFieldFr id="expires_at" name="expires_at" />
          </div>
          <div className="space-y-4">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="border-input bg-background flex w-full rounded-md border px-12 py-8 text-sm"
            />
          </div>

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
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
