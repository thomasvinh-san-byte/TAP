'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { VEHICLE_TYPE_VALUES, type VehicleType } from '@tap/shared';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/form/field';
import { NumberField } from '@/components/form/number-field';
import { Combobox } from '@/components/form/combobox.client';
import { FormSection, FormRow, FormActions } from '@/components/form/form-layout';
import { VEHICLE_BRANDS, modelsForBrand } from '@/lib/vehicles/catalog';
import { ComplianceFieldset } from '../../conformite/_components/compliance-fieldset.client';
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

/**
 * Formulaire véhicule (création + édition) — refondu sur le patron de form
 * partagé (Phase 06.52, DEC-131) : `FormSection`/`FormRow`/`FormActions`,
 * champs homogènes (Field/Combobox/Select/NumberField). Layout souple 1 colonne
 * (rendu en Sheet, peu de champs). Données/validation/Server Actions inchangées.
 */
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
    <form action={formAction} className="w-full max-w-[640px] space-y-24">
      <FormSection title="Identification">
        <div className="max-w-[220px]">
          <Field
            id="immatriculation"
            label="Immatriculation"
            defaultValue={initial?.immatriculation ?? ''}
            hint="Format : AB-123-CD"
            placeholder="AB-123-CD"
            error={fe.immatriculation}
            autoFocus
            required
            maxLength={9}
            className="uppercase tabular-nums"
          />
        </div>
        <FormRow>
          <Combobox
            id="marque"
            label="Marque"
            options={VEHICLE_BRANDS}
            value={marque}
            onChange={setMarque}
            hint="Liste indicative : saisie libre permise."
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
        </FormRow>
      </FormSection>

      <FormSection title="Caractéristiques">
        <div className="max-w-[280px] space-y-8">
          <Label htmlFor="type">Type</Label>
          <input type="hidden" name="type" value={type} />
          <Select
            ariaLabel="Type de véhicule"
            value={type}
            onChange={(v) => setType(v as VehicleType)}
            items={VEHICLE_TYPE_VALUES.map((v) => ({ value: v, label: TYPE_LABELS[v] }))}
            triggerClassName="w-full"
          />
          {fe.type && (
            <p className="text-destructive text-xs" role="alert">
              {fe.type}
            </p>
          )}
        </div>
        <FormRow>
          <NumberField
            id="places_assises"
            label="Places assises"
            min={1}
            max={9}
            kind="counter"
            defaultValue={initial?.places_assises ?? null}
            hint="1 à 9"
            error={fe.places_assises}
          />
          <NumberField
            id="places_tpmr"
            label="Places TPMR"
            min={0}
            max={3}
            kind="counter"
            defaultValue={initial?.places_tpmr ?? null}
            hint="0 à 3"
            error={fe.places_tpmr}
          />
        </FormRow>
      </FormSection>

      <FormSection title="Disponibilité">
        <div className="flex items-center gap-12">
          <input
            id="actif"
            type="checkbox"
            name="actif"
            defaultChecked={initial?.actif ?? true}
            className="border-border h-16 w-16 rounded"
          />
          <Label htmlFor="actif">
            Véhicule actif (apparaît dans la fenêtre d&apos;affectation)
          </Label>
        </div>
      </FormSection>

      {state.error && !state.fieldErrors && (
        <p className="text-destructive text-sm" role="alert">
          {state.error}
        </p>
      )}

      <FormActions>
        <SubmitButton edit={Boolean(initial)} />
      </FormActions>

      {initial && (
        <FormSection title="Conformité">
          <ComplianceFieldset entityType="vehicle" entityId={initial.id} />
        </FormSection>
      )}
    </form>
  );
}

function SubmitButton({ edit }: { edit: boolean }): JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10">
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
