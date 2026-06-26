'use client';

import { useState, useTransition } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NumberField } from '@/components/form/number-field';
import { FormSection } from '@/components/form/form-layout';
import { DateFieldFr } from '@/components/date-field-fr.client';
import type { TariffGridRow } from '../page';
import { saveTariffGridAction } from '../actions';

/**
 * Édition d'une grille tarifaire = INSERT d'une nouvelle version datée
 * (DEC-057 — versionnement strict). Les champs sont pré-remplis depuis la
 * grille active courante (pas de constantes hardcodées). Date d'effet par
 * défaut = demain.
 */
function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

interface NumField {
  name: string;
  label: string;
  step: number;
  defaultValue: number;
  hint?: string;
}

export function TariffEditSheet({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: TariffGridRow;
}): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fields: NumField[] = [
    { name: 'forfait_eur', label: 'Forfait (€)', step: 0.01, defaultValue: current.forfait_eur },
    { name: 'km_inclus', label: 'Km inclus', step: 1, defaultValue: current.km_inclus },
    {
      name: 'prix_km_eur',
      label: 'Prix au km (€)',
      step: 0.01,
      defaultValue: current.prix_km_eur,
    },
    {
      name: 'supplement_drom_eur',
      label: 'Supplément DROM (€)',
      step: 0.01,
      defaultValue: current.supplement_drom_eur,
    },
    {
      name: 'supplement_tpmr_eur',
      label: 'Supplément TPMR (€)',
      step: 0.01,
      defaultValue: current.supplement_tpmr_eur,
    },
    {
      name: 'supplement_accompagnant_eur',
      label: 'Supplément accompagnant (€)',
      step: 0.01,
      defaultValue: current.supplement_accompagnant_eur ?? 0,
    },
    {
      name: 'majoration_pct',
      label: 'Majoration (%)',
      step: 1,
      defaultValue: current.majoration_pct,
    },
    {
      name: 'facteur_correction_routier',
      label: 'Facteur correction',
      step: 0.01,
      defaultValue: current.facteur_correction_routier,
    },
    { name: 'arrondi_eur', label: 'Arrondi (€)', step: 0.01, defaultValue: current.arrondi_eur },
  ];

  function handleSubmit(formData: FormData): void {
    setError(null);
    startTransition(async () => {
      const result = await saveTariffGridAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nouvelle version de grille</SheetTitle>
          <SheetDescription>
            La grille actuelle reste inchangée. Une nouvelle version datée est créée.
            L&apos;historique est conservé.
          </SheetDescription>
        </SheetHeader>

        <form action={handleSubmit} className="space-y-24 py-16">
          <FormSection title="Période d'application">
            <div className="space-y-8">
              <Label htmlFor="tg-date">Date d&apos;effet</Label>
              <DateFieldFr id="tg-date" name="date_effet" defaultValue={tomorrowIso()} required />
            </div>
          </FormSection>

          <FormSection title="Paramètres tarifaires">
            {fields.map((f) => (
              <NumberField
                key={f.name}
                id={`tg-${f.name}`}
                name={f.name}
                label={f.label}
                min={0}
                step={f.step}
                defaultValue={f.defaultValue}
                required
              />
            ))}
          </FormSection>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? 'Enregistrement…' : 'Créer la version'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
