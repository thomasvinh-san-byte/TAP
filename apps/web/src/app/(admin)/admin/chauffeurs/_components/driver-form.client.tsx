'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { TYPE_PERMIS_VALUES, type TypePermis } from '@tap/shared';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/form/field';
import { FormSection, FormRow, FormActions } from '@/components/form/form-layout';
import { ComplianceFieldset } from '../../conformite/_components/compliance-fieldset.client';
import { type ActionState, createDriverAction, updateDriverAction } from '../actions';
import type { DriverRow } from '../page';

const TYPE_PERMIS_LABELS: Record<TypePermis, string> = {
  taxi: 'Taxi',
  ambulance: 'Ambulance',
  vsl: 'VSL',
  tpmr: 'TPMR',
};

interface Props {
  initial?: DriverRow;
  onSuccess?: (id: string) => void;
}

/**
 * Formulaire chauffeur (création + édition) — refondu sur le patron de form
 * partagé (Phase 06.52, DEC-131) : `FormSection`/`FormRow`/`FormActions`,
 * champs homogènes (Field), checkboxes propres (fin des labels bricolés
 * `border-input px-12 py-8`). Layout souple 1 colonne (rendu en Sheet).
 * useFormState + useFormStatus. Données/validation/Server Actions inchangées.
 */
export function DriverForm({ initial, onSuccess }: Props): JSX.Element {
  const action = initial ? updateDriverAction.bind(null, initial.id) : createDriverAction;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

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
      <FormSection title="Identité & contact">
        <Field
          id="nom_affichage"
          label="Nom affiché"
          defaultValue={initial?.nom_affichage ?? ''}
          error={fe.nom_affichage}
          autoFocus
          required
        />
        <FormRow>
          <Field
            id="telephone"
            label="Téléphone"
            type="tel"
            inputMode="tel"
            defaultValue={initial?.telephone ?? ''}
            error={fe.telephone}
            hint="Format libre (ex : 06 12 34 56 78)."
            placeholder="06 12 34 56 78"
            maxLength={14}
          />
          <Field
            id="numero_licence"
            label="Numéro de licence"
            defaultValue={initial?.numero_licence ?? ''}
            error={fe.numero_licence}
          />
        </FormRow>
      </FormSection>

      <FormSection title="Types de permis">
        <div className="grid grid-cols-2 gap-12">
          {TYPE_PERMIS_VALUES.map((v) => (
            <div key={v} className="flex items-center gap-12">
              <input
                id={`type_permis_${v}`}
                type="checkbox"
                name="type_permis"
                value={v}
                defaultChecked={initial?.type_permis?.includes(v) ?? false}
                className="border-border h-16 w-16 rounded"
              />
              <Label htmlFor={`type_permis_${v}`}>{TYPE_PERMIS_LABELS[v]}</Label>
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Statut">
        <div className="flex items-center gap-12">
          <input
            id="actif"
            type="checkbox"
            name="actif"
            defaultChecked={initial?.actif ?? true}
            className="border-border h-16 w-16 rounded"
          />
          <Label htmlFor="actif">
            Chauffeur actif (apparaît dans la fenêtre d&apos;affectation)
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
          <ComplianceFieldset entityType="driver" entityId={initial.id} />
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
          : 'Créer le chauffeur'}
    </Button>
  );
}
