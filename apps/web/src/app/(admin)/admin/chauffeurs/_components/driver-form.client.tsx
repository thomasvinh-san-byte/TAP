'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  DRIVER_COMPETENCE_LABELS,
  DRIVER_COMPETENCE_VALUES,
  DRIVER_FORM_STATUS_VALUES,
  DRIVER_LANGUE_LABELS,
  DRIVER_LANGUE_VALUES,
  DRIVER_STATUS_LABELS,
  TYPE_PERMIS_VALUES,
  type DriverFormStatus,
  type TypePermis,
} from '@tap/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { Field } from '@/components/form/field';
import { FormSection, FormRow } from '@/components/form/form-layout';
import { cn } from '@/lib/utils';
import { ComplianceFieldset } from '../../conformite/_components/compliance-fieldset.client';
import { type ActionState, createDriverAction, updateDriverAction } from '../actions';
import type { DriverRow } from '../page';

const TYPE_PERMIS_LABELS: Record<TypePermis, string> = {
  taxi: 'Taxi',
  ambulance: 'Ambulance',
  vsl: 'VSL',
  tpmr: 'TPMR',
};

/**
 * Groupe de cases à cocher tokenisées multivaluées (permis / compétences /
 * langues). Valeur cochée → présente dans le tableau `name` à la soumission.
 */
function CheckboxChipGroup<T extends string>({
  name,
  values,
  labels,
  selected,
}: {
  name: string;
  values: readonly T[];
  labels: Record<T, string>;
  selected: readonly string[] | undefined;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-12">
      {values.map((v) => (
        <label
          key={v}
          className={cn(
            'flex cursor-pointer items-center gap-12 rounded-md border px-12 py-12 transition-colors',
            'border-input hover:bg-muted/50',
            'has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary',
          )}
        >
          <Checkbox name={name} value={v} defaultChecked={selected?.includes(v) ?? false} />
          <span className="text-sm font-medium">{labels[v]}</span>
        </label>
      ))}
    </div>
  );
}

interface Props {
  initial?: DriverRow;
  onSuccess?: (id: string) => void;
  /** Ferme le drawer (bouton Annuler). */
  onCancel?: () => void;
  /** Archiver (édition, dirigeant) — affiche le bouton destructif en bas du corps. */
  onArchive?: () => void;
  /** Échafaudage upload documents conformité (DEC-143, évalué serveur). */
  uploadEnabled?: boolean;
}

/**
 * Formulaire chauffeur (création + édition) — drawer structuré 3 zones
 * (Phase 06.60, DEC-139) : corps scrollable + `SheetFooter` ancré (la
 * `SheetHeader` est rendue par la liste). Permis en chips cliquables,
 * checkbox tokenisée (`ui/Checkbox`), statut hors `FormSection`. Largeur =
 * celle du drawer (w-full). Données/validation/Server Actions inchangées.
 */
export function DriverForm({
  initial,
  onSuccess,
  onCancel,
  onArchive,
  uploadEnabled = false,
}: Props): JSX.Element {
  const action = initial ? updateDriverAction.bind(null, initial.id) : createDriverAction;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  // Statut saisissable (actif / conge / suspendu). L'archivage est géré par le
  // flux dédié. Si on édite un chauffeur archivé (cas limite), on retombe sur
  // une valeur valide — la sauvegarde reste bloquée côté action (.eq archive).
  const initialStatus: DriverFormStatus =
    initial && initial.status !== 'archive' ? (initial.status as DriverFormStatus) : 'actif';
  const [status, setStatus] = React.useState<DriverFormStatus>(initialStatus);

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
          <CheckboxChipGroup
            name="type_permis"
            values={TYPE_PERMIS_VALUES}
            labels={TYPE_PERMIS_LABELS}
            selected={initial?.type_permis}
          />
        </FormSection>

        <FormSection title="Compétences">
          <CheckboxChipGroup
            name="competences"
            values={DRIVER_COMPETENCE_VALUES}
            labels={DRIVER_COMPETENCE_LABELS}
            selected={initial?.competences}
          />
        </FormSection>

        <FormSection title="Langues parlées">
          <CheckboxChipGroup
            name="langues"
            values={DRIVER_LANGUE_VALUES}
            labels={DRIVER_LANGUE_LABELS}
            selected={initial?.langues}
          />
        </FormSection>

        {/* Statut chauffeur (§5.6) : seul « actif » est proposé à l'affectation. */}
        <div className="border-border space-y-8 border-t pt-12">
          <Label htmlFor="driver-status">Statut</Label>
          <input type="hidden" name="status" value={status} />
          <Select
            ariaLabel="Statut du chauffeur"
            value={status}
            onChange={(v) => setStatus(v as DriverFormStatus)}
            items={DRIVER_FORM_STATUS_VALUES.map((s) => ({
              value: s,
              label: DRIVER_STATUS_LABELS[s],
            }))}
            triggerClassName="w-full"
          />
          <p className="text-muted-foreground text-xs">
            Seul un chauffeur actif apparaît dans la fenêtre d&apos;affectation. L&apos;archivage se
            fait via le bouton dédié.
          </p>
        </div>

        {state.error && !state.fieldErrors && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}

        {initial && (
          <FormSection title="Conformité">
            <ComplianceFieldset
              entityType="driver"
              entityId={initial.id}
              uploadEnabled={uploadEnabled}
            />
          </FormSection>
        )}

        {initial && onArchive && (
          <div className="border-border border-t pt-16">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
              onClick={onArchive}
            >
              Archiver ce chauffeur
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
          : 'Créer le chauffeur'}
    </Button>
  );
}
