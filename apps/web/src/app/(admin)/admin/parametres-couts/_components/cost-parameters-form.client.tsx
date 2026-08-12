'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveCostParametersAction } from '../actions';

interface Props {
  initial: {
    cout_carburant_eur_km: number;
    cout_entretien_eur_km: number;
    cout_amortissement_eur_km: number;
  } | null;
}

const FIELDS = [
  {
    name: 'cout_carburant_eur_km',
    label: 'Carburant (€/km)',
    hint: 'Coût carburant estimé par kilomètre parcouru.',
  },
  {
    name: 'cout_entretien_eur_km',
    label: 'Entretien (€/km)',
    hint: 'Entretien et réparations rapportés au kilomètre.',
  },
  {
    name: 'cout_amortissement_eur_km',
    label: 'Amortissement (€/km)',
    hint: 'Amortissement du véhicule rapporté au kilomètre.',
  },
] as const;

/**
 * Formulaire des paramètres de coût (§5.20 lot E) — dirigeant. Trois composantes
 * €/km ; leur somme = le coût/km utilisé pour la marge. Saisie simple, feedback
 * immédiat, total récapitulé en direct.
 */
export function CostParametersForm({ initial }: Props): JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [values, setValues] = React.useState({
    cout_carburant_eur_km: initial?.cout_carburant_eur_km ?? 0,
    cout_entretien_eur_km: initial?.cout_entretien_eur_km ?? 0,
    cout_amortissement_eur_km: initial?.cout_amortissement_eur_km ?? 0,
  });

  const total =
    Number(values.cout_carburant_eur_km || 0) +
    Number(values.cout_entretien_eur_km || 0) +
    Number(values.cout_amortissement_eur_km || 0);

  const onSubmit = async (formData: FormData): Promise<void> => {
    setPending(true);
    const res = await saveCostParametersAction(formData);
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Paramètres de coût enregistrés.');
  };

  return (
    <form action={onSubmit} className="space-y-16">
      <div className="grid gap-16 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <div key={f.name} className="space-y-4">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              name={f.name}
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0"
              max="99"
              value={values[f.name]}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.valueAsNumber || 0 }))}
              className="tabular-nums"
            />
            <p className="text-muted-foreground text-xs leading-[1.4]">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="border-border bg-muted/20 flex items-center justify-between rounded-md border p-12 text-sm">
        <span className="text-muted-foreground">Coût / km total</span>
        <span className="font-medium tabular-nums">
          {new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 3,
          }).format(total)}{' '}
          €/km
        </span>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? 'Enregistrement…' : 'Enregistrer les coûts'}
      </Button>
    </form>
  );
}
