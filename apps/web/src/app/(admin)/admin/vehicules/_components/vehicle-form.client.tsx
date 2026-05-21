'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { VEHICLE_TYPE_VALUES, type VehicleType } from '@tap/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type ActionState, createVehicleAction, updateVehicleAction } from '../actions';
import type { VehicleRow } from '../page';

const TYPE_LABELS: Record<VehicleType, string> = {
  taxi_conventionne: 'Taxi conventionné',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

// Marques courantes des flottes 974 — liste indicative pour la datalist.
// La saisie reste LIBRE (aide, pas contrainte) : validation Server Action
// inchangée (marque = string non vide, pas d'enum).
const MARQUES_VEHICULE = [
  'Renault',
  'Peugeot',
  'Citroën',
  'Dacia',
  'Toyota',
  'Mercedes-Benz',
  'Volkswagen',
  'Ford',
  'Opel',
  'Hyundai',
  'Kia',
  'Fiat',
  'Nissan',
  'Škoda',
  'BMW',
  'Suzuki',
];

interface Props {
  initial?: VehicleRow;
  onSuccess?: (id: string) => void;
}

export function VehicleForm({ initial, onSuccess }: Props): JSX.Element {
  const action = initial ? updateVehicleAction.bind(null, initial.id) : createVehicleAction;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  const [type, setType] = React.useState<VehicleType>(initial?.type ?? 'taxi_conventionne');

  const previouslyOk = React.useRef(false);
  React.useEffect(() => {
    if (state.success && state.id && !previouslyOk.current) {
      previouslyOk.current = true;
      onSuccess?.(state.id);
    }
  }, [state, onSuccess]);

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-16">
      <Field
        id="immatriculation"
        label="Immatriculation"
        defaultValue={initial?.immatriculation ?? ''}
        error={fe.immatriculation}
        autoFocus
        required
        className="uppercase tabular-nums"
      />

      <div className="grid grid-cols-2 gap-12">
        <Field
          id="marque"
          label="Marque"
          defaultValue={initial?.marque ?? ''}
          error={fe.marque}
          list="vehicle-marques"
        />
        <Field id="modele" label="Modèle" defaultValue={initial?.modele ?? ''} error={fe.modele} />
      </div>
      <datalist id="vehicle-marques">
        {MARQUES_VEHICULE.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="space-y-8">
        <Label htmlFor="type">Type</Label>
        <input type="hidden" name="type" value={type} />
        <Select
          ariaLabel="Type de véhicule"
          value={type}
          onChange={(v) => setType(v as VehicleType)}
          items={VEHICLE_TYPE_VALUES.map((v) => ({
            value: v,
            label: TYPE_LABELS[v],
          }))}
          triggerClassName="w-full"
        />
        {fe.type && (
          <p className="text-destructive text-xs" role="alert">
            {fe.type}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-12">
        <Field
          id="places_assises"
          label="Places assises"
          type="number"
          min={1}
          max={9}
          defaultValue={initial?.places_assises ?? ''}
          error={fe.places_assises}
        />
        <Field
          id="places_tpmr"
          label="Places TPMR"
          type="number"
          min={0}
          max={3}
          defaultValue={initial?.places_tpmr ?? ''}
          error={fe.places_tpmr}
        />
      </div>

      <label className="border-input hover:bg-muted flex cursor-pointer items-center gap-8 rounded-md border px-12 py-8 text-sm">
        <input
          type="checkbox"
          name="actif"
          defaultChecked={initial?.actif ?? true}
          className="h-16 w-16"
        />
        Véhicule actif (apparaît dans la fenêtre d&apos;affectation)
      </label>

      {state.error && !state.fieldErrors && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton edit={Boolean(initial)} />
    </form>
  );
}

function Field({
  id,
  label,
  error,
  className,
  ...rest
}: {
  id: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-8">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        autoComplete="off"
        {...rest}
      />
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ edit }: { edit: boolean }): JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending
        ? edit
          ? 'Enregistrement…'
          : 'Création…'
        : edit
          ? 'Enregistrer les modifications'
          : 'Créer le véhicule'}
    </Button>
  );
}
