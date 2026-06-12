'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { PRESCRIBER_TYPE_VALUES, type PrescriberType } from '@tap/shared';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { Field } from '@/components/form/field';
import { FormSection, FormRow } from '@/components/form/form-layout';
import { type ActionState, createPrescriberAction, updatePrescriberAction } from '../actions';
import type { PrescriberRow } from '../page';

const TYPE_LABELS: Record<PrescriberType, string> = {
  medecin: 'Médecin',
  etablissement: 'Établissement',
};

interface Props {
  initial?: PrescriberRow;
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
  onArchive?: () => void;
}

/**
 * Formulaire prescripteur (création + édition) — drawer 3 zones (pattern
 * donneur d'ordres). Identifiants conditionnels au type : RPPS/ADELI (médecin),
 * FINESS (établissement). Validation `prescriberInputSchema` (@tap/shared).
 */
export function PrescriberForm({ initial, onSuccess, onCancel, onArchive }: Props): JSX.Element {
  const action = initial ? updatePrescriberAction.bind(null, initial.id) : createPrescriberAction;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  const [type, setType] = React.useState<PrescriberType>(initial?.type ?? 'medecin');

  const previouslyOk = React.useRef(false);
  React.useEffect(() => {
    if (state.success && state.id && !previouslyOk.current) {
      previouslyOk.current = true;
      onSuccess?.(state.id);
    }
  }, [state, onSuccess]);

  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-24 overflow-y-auto px-24 py-16">
        <FormSection title="Identité">
          <FormRow>
            <Field
              id="nom"
              name="nom"
              label="Nom"
              defaultValue={initial?.nom ?? ''}
              placeholder="Nom du médecin ou de l'établissement"
              error={fe.nom}
              autoFocus
              required
              maxLength={120}
            />
            <Field
              id="prenom"
              name="prenom"
              label="Prénom"
              hint="Médecin uniquement"
              defaultValue={initial?.prenom ?? ''}
              error={fe.prenom}
              maxLength={120}
            />
          </FormRow>
          <div className="max-w-[260px] space-y-8">
            <Label htmlFor="type">Type</Label>
            <input type="hidden" name="type" value={type} />
            <Select
              ariaLabel="Type de prescripteur"
              value={type}
              onChange={(v) => setType(v as PrescriberType)}
              items={PRESCRIBER_TYPE_VALUES.map((v) => ({ value: v, label: TYPE_LABELS[v] }))}
              triggerClassName="w-full"
            />
          </div>
        </FormSection>

        <FormSection title="Identifiants">
          {type === 'medecin' ? (
            <FormRow>
              <Field
                id="rpps"
                name="rpps"
                label="RPPS"
                hint="11 chiffres (facultatif)"
                defaultValue={initial?.rpps ?? ''}
                error={fe.rpps}
                inputMode="numeric"
                maxLength={11}
                className="tabular-nums"
              />
              <Field
                id="adeli"
                name="adeli"
                label="ADELI"
                hint="9 chiffres (facultatif)"
                defaultValue={initial?.adeli ?? ''}
                error={fe.adeli}
                inputMode="numeric"
                maxLength={9}
                className="tabular-nums"
              />
            </FormRow>
          ) : (
            <div className="max-w-[260px]">
              <Field
                id="finess"
                name="finess"
                label="FINESS"
                hint="9 chiffres (facultatif)"
                defaultValue={initial?.finess ?? ''}
                error={fe.finess}
                inputMode="numeric"
                maxLength={9}
                className="tabular-nums"
              />
            </div>
          )}
          <Field
            id="specialite"
            name="specialite"
            label="Spécialité"
            defaultValue={initial?.specialite ?? ''}
            placeholder="Néphrologie, oncologie…"
            error={fe.specialite}
            maxLength={120}
          />
        </FormSection>

        <FormSection title="Contact">
          <FormRow>
            <Field
              id="contact_telephone"
              name="contact_telephone"
              label="Téléphone"
              defaultValue={initial?.contact_telephone ?? ''}
              placeholder="0262 00 00 00"
              error={fe.contact_telephone}
              inputMode="tel"
              maxLength={30}
            />
            <Field
              id="contact_email"
              name="contact_email"
              label="E-mail"
              defaultValue={initial?.contact_email ?? ''}
              placeholder="cabinet@exemple.re"
              error={fe.contact_email}
              inputMode="email"
              maxLength={160}
            />
          </FormRow>
          <Field
            id="adresse"
            name="adresse"
            label="Adresse"
            defaultValue={initial?.adresse ?? ''}
            placeholder="Cabinet ou service"
            error={fe.adresse}
            maxLength={200}
          />
        </FormSection>

        <div className="border-border border-t pt-12">
          <label className="flex cursor-pointer items-center gap-12">
            <Checkbox name="actif" defaultChecked={initial?.actif ?? true} />
            <span className="text-sm">Prescripteur actif</span>
          </label>
        </div>

        {state.error && !state.fieldErrors && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}

        {initial && onArchive && (
          <div className="border-border border-t pt-16">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
              onClick={onArchive}
            >
              Archiver ce prescripteur
            </Button>
          </div>
        )}
      </div>

      <SheetFooter className="border-border shrink-0 gap-12 border-t px-24 py-16">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <SubmitButton edit={Boolean(initial)} />
      </SheetFooter>
    </form>
  );
}

function SubmitButton({ edit }: { edit: boolean }): JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? edit
          ? 'Enregistrement…'
          : 'Création…'
        : edit
          ? 'Enregistrer les modifications'
          : 'Créer le prescripteur'}
    </Button>
  );
}
