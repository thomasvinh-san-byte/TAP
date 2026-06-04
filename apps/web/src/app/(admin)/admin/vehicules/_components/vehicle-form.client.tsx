'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { VEHICLE_TYPE_VALUES, type VehicleType } from '@tap/shared';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { Combobox } from '@/components/form/combobox.client';
import { VEHICLE_BRANDS, modelsForBrand } from '@/lib/vehicles/catalog';
import { type ActionState, createVehicleAction, updateVehicleAction } from '../actions';
import type { VehicleRow } from '../page';

const TYPE_LABELS: Record<VehicleType, string> = {
  taxi_conventionne: 'Taxi conventionné',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

interface Props {
  initial?: VehicleRow;
  onSuccess?: (id: string) => void;
}

export function VehicleForm({ initial, onSuccess }: Props): JSX.Element {
  const action = initial ? updateVehicleAction.bind(null, initial.id) : createVehicleAction;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  const [type, setType] = React.useState<VehicleType>(initial?.type ?? 'taxi_conventionne');
  const [marque, setMarque] = React.useState<string>(initial?.marque ?? '');
  const [modele, setModele] = React.useState<string>(initial?.modele ?? '');

  // Phase 06.17 D-06 : modèles dépendants de la marque. Si marque inconnue
  // (saisie libre, modelsForBrand → []), la combobox reste en saisie libre.
  const modelOptions = React.useMemo(() => modelsForBrand(marque), [marque]);

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
        hint="Format : AB-123-CD"
        placeholder="AB-123-CD"
        error={fe.immatriculation}
        autoFocus
        required
        className="uppercase tabular-nums"
      />

      <div className="grid grid-cols-2 gap-12">
        <Combobox
          id="marque"
          label="Marque"
          options={VEHICLE_BRANDS}
          value={marque}
          onChange={(v) => {
            setMarque(v);
            // Si on quitte une marque connue → la combobox modèle reste
            // libre. Si on revient sur une marque connue, l'utilisateur
            // re-pioche dans la liste. On ne réinitialise PAS le modèle
            // automatiquement pour ne pas effacer une saisie en cours.
          }}
          hint="Liste indicative — saisie libre permise."
          error={fe.marque}
        />
        <Combobox
          id="modele"
          label="Modèle"
          options={modelOptions}
          value={modele}
          onChange={setModele}
          hint={modelOptions.length > 0 ? `Modèles connus pour ${marque}.` : 'Saisie libre.'}
          error={fe.modele}
        />
      </div>

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
          // D-03 : numérique borné SANS spinner ni molette accidentelle.
          // type="text" + inputMode=numeric → clavier numérique mobile,
          // pas de boutons up/down. Validation côté Server Action.
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={initial?.places_assises ?? ''}
          hint="1 à 9"
          error={fe.places_assises}
        />
        <Field
          id="places_tpmr"
          label="Places TPMR"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          defaultValue={initial?.places_tpmr ?? ''}
          hint="0 à 3"
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
