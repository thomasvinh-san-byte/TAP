'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  TYPE_PERMIS_VALUES,
  type TypePermis,
} from '@tap/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type ActionState,
  createDriverAction,
  updateDriverAction,
} from '../actions';
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
 * Formulaire création / édition d'un chauffeur (clôture-bis Passe 1).
 *
 * Pattern repo : useFormState + useFormStatus (cf. login-form / dev-switcher).
 * Le mode édition lie l'action via .bind(null, driverId) — la signature de
 * `updateDriverAction` est `(driverId, _prev, formData)`.
 *
 * Erreurs par champ exposées via `state.fieldErrors` (cf. flatten zod
 * pattern de courses/edit + ride-express-modal).
 */
export function DriverForm({ initial, onSuccess }: Props): JSX.Element {
  const action = initial
    ? updateDriverAction.bind(null, initial.id)
    : createDriverAction;
  const [state, formAction] = useFormState<ActionState, FormData>(
    action,
    {},
  );

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
        id="nom_affichage"
        label="Nom affiché"
        defaultValue={initial?.nom_affichage ?? ''}
        error={fe.nom_affichage}
        autoFocus
        required
      />

      <Field
        id="telephone"
        label="Téléphone"
        type="tel"
        defaultValue={initial?.telephone ?? ''}
        error={fe.telephone}
      />

      <Field
        id="numero_licence"
        label="Numéro de licence"
        defaultValue={initial?.numero_licence ?? ''}
        error={fe.numero_licence}
      />

      <fieldset className="space-y-8">
        <legend className="text-sm font-medium">Types de permis</legend>
        <div className="grid grid-cols-2 gap-8">
          {TYPE_PERMIS_VALUES.map((v) => (
            <label
              key={v}
              className="flex items-center gap-8 rounded-md border border-input px-12 py-8 text-sm cursor-pointer hover:bg-muted"
            >
              <input
                type="checkbox"
                name="type_permis"
                value={v}
                defaultChecked={initial?.type_permis?.includes(v) ?? false}
                className="h-16 w-16"
              />
              {TYPE_PERMIS_LABELS[v]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-8 rounded-md border border-input px-12 py-8 text-sm cursor-pointer hover:bg-muted">
        <input
          type="checkbox"
          name="actif"
          defaultChecked={initial?.actif ?? true}
          className="h-16 w-16"
        />
        Chauffeur actif (apparaît dans la modal d&apos;assignation)
      </label>

      {state.error && !state.fieldErrors && (
        <p className="text-sm text-destructive" role="alert">
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
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        autoComplete="off"
        {...rest}
      />
      {error && (
        <p className="text-xs text-destructive" role="alert">
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
          : 'Créer le chauffeur'}
    </Button>
  );
}
