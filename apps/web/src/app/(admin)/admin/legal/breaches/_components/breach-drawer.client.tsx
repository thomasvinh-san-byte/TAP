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
import { NumberField } from '@/components/form/number-field';
import { createBreachAction } from '../actions';
import {
  SEVERITY_OPTS,
  NATURE_OPTS,
  SelectField,
  CheckboxField,
} from './breach-form-fields.client';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Drawer création incident violation (D-08). Largeur 400px.
 */
export function BreachDrawer({ open, onOpenChange }: Props) {
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(undefined);
    startTransition(async () => {
      const res = await createBreachAction({ error: undefined }, formData);
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
          <SheetTitle>Nouvel incident</SheetTitle>
          <SheetDescription>Article 33 RGPD : délai notification 72h</SheetDescription>
        </SheetHeader>

        <form action={onSubmit} className="mt-24 space-y-16">
          <div className="space-y-4">
            <Label htmlFor="detected_at">Détecté le</Label>
            <Input
              id="detected_at"
              name="detected_at"
              type="datetime-local"
              required
              defaultValue={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <SelectField id="severity" label="Gravité" options={SEVERITY_OPTS} />
          <SelectField id="nature" label="Nature" options={NATURE_OPTS} />
          <div className="space-y-4">
            <Label htmlFor="affected_data_categories">Catégories de données (virgule)</Label>
            <Input
              id="affected_data_categories"
              name="affected_data_categories"
              required
              placeholder="identite, sante"
            />
          </div>
          <NumberField
            id="affected_subjects_count"
            label="Nombre de personnes concernées"
            min={0}
            kind="counter"
            hint="Nombre estimé de personnes dont les données sont touchées."
          />
          <div className="space-y-4">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              name="description"
              rows={3}
              required
              className="border-input bg-background flex w-full rounded-md border px-12 py-8 text-sm"
            />
          </div>
          <div className="space-y-4">
            <Label htmlFor="immediate_measures">Mesures immédiates</Label>
            <textarea
              id="immediate_measures"
              name="immediate_measures"
              rows={3}
              required
              className="border-input bg-background flex w-full rounded-md border px-12 py-8 text-sm"
            />
          </div>
          <CheckboxField id="cnil_notification_required" label="Notification CNIL requise" />
          <CheckboxField
            id="subjects_notification_required"
            label="Notification personnes concernées"
          />

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
