'use client';

import * as React from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import {
  ORDERING_PARTY_BILLING_MODALITY_VALUES,
  ORDERING_PARTY_TARIFF_MODE_VALUES,
  type OrderingPartyBillingModality,
  type OrderingPartyTariffMode,
} from '@tap/shared';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select } from '@/components/ui/select';
import { SheetFooter } from '@/components/ui/sheet';
import { Field } from '@/components/form/field';
import { FormSection, FormRow } from '@/components/form/form-layout';
import { type ActionState, createOrderingPartyAction, updateOrderingPartyAction } from '../actions';
import { OrderingPartyTariffForm } from './ordering-party-tariff-form.client';
import type { OrderingPartyRow } from '../page';

const MODALITE_LABELS: Record<OrderingPartyBillingModality, string> = {
  a_la_course: 'À la course',
  hebdomadaire: 'Récapitulatif hebdomadaire',
  mensuelle: 'Récapitulatif mensuel',
};

const TARIFF_MODE_LABELS: Record<OrderingPartyTariffMode, string> = {
  cgss_standard: 'Grille CGSS de l’organisation',
  grille_propre: 'Grille propre au donneur d’ordres',
};

interface Props {
  initial?: OrderingPartyRow;
  onSuccess?: (id: string) => void;
  /** Ferme le drawer (bouton Annuler). */
  onCancel?: () => void;
  /** Archiver (édition) — affiche le bouton destructif en bas du corps. */
  onArchive?: () => void;
}

/**
 * Formulaire donneur d'ordres B2B (création + édition) — drawer structuré
 * 3 zones (pattern véhicule, DEC-139) : corps scrollable + `SheetFooter`
 * ancré. Patron `FormSection/FormRow`, primitives `Field`/`Select`/`Checkbox`.
 * Validation `orderingPartyInputSchema` (SIRET via siretSchema si renseigné).
 */
export function OrderingPartyForm({ initial, onSuccess, onCancel, onArchive }: Props): JSX.Element {
  const action = initial
    ? updateOrderingPartyAction.bind(null, initial.id)
    : createOrderingPartyAction;
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});

  const [modalite, setModalite] = React.useState<OrderingPartyBillingModality>(
    initial?.modalite_facturation ?? 'a_la_course',
  );
  const [tariffMode, setTariffMode] = React.useState<OrderingPartyTariffMode>(
    initial?.tariff_mode ?? 'cgss_standard',
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
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-24 overflow-y-auto px-24 py-16">
        <FormSection title="Identité">
          <Field
            id="raison_sociale"
            name="raison_sociale"
            label="Raison sociale"
            defaultValue={initial?.raison_sociale ?? ''}
            placeholder="Centre Hospitalier Universitaire"
            error={fe.raison_sociale}
            autoFocus
            required
            maxLength={120}
          />
          <div className="max-w-[260px]">
            <Field
              id="siret"
              name="siret"
              label="SIRET"
              defaultValue={initial?.siret ?? ''}
              hint="14 chiffres (facultatif)"
              placeholder="40483304800014"
              error={fe.siret}
              inputMode="numeric"
              maxLength={14}
              className="tabular-nums"
            />
          </div>
        </FormSection>

        <FormSection title="Contact principal">
          <Field
            id="contact_principal_nom"
            name="contact_principal_nom"
            label="Nom du contact"
            defaultValue={initial?.contact_principal_nom ?? ''}
            placeholder="Service transport"
            error={fe.contact_principal_nom}
            maxLength={120}
          />
          <FormRow>
            <Field
              id="contact_principal_telephone"
              name="contact_principal_telephone"
              label="Téléphone"
              defaultValue={initial?.contact_principal_telephone ?? ''}
              placeholder="0262 00 00 00"
              error={fe.contact_principal_telephone}
              inputMode="tel"
              maxLength={30}
            />
            <Field
              id="contact_principal_email"
              name="contact_principal_email"
              label="E-mail"
              defaultValue={initial?.contact_principal_email ?? ''}
              placeholder="transport@etablissement.re"
              error={fe.contact_principal_email}
              inputMode="email"
              maxLength={160}
            />
          </FormRow>
        </FormSection>

        <FormSection title="Facturation">
          <div className="max-w-[320px] space-y-8">
            <Label htmlFor="modalite_facturation">Modalité de facturation</Label>
            <input type="hidden" name="modalite_facturation" value={modalite} />
            <Select
              ariaLabel="Modalité de facturation"
              value={modalite}
              onChange={(v) => setModalite(v as OrderingPartyBillingModality)}
              items={ORDERING_PARTY_BILLING_MODALITY_VALUES.map((v) => ({
                value: v,
                label: MODALITE_LABELS[v],
              }))}
              triggerClassName="w-full"
            />
            {fe.modalite_facturation && (
              <p className="text-destructive text-xs" role="alert">
                {fe.modalite_facturation}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection title="Tarification">
          <div className="max-w-[320px] space-y-8">
            <Label htmlFor="tariff_mode">Mode de tarification</Label>
            <input type="hidden" name="tariff_mode" value={tariffMode} />
            <Select
              ariaLabel="Mode de tarification"
              value={tariffMode}
              onChange={(v) => setTariffMode(v as OrderingPartyTariffMode)}
              items={ORDERING_PARTY_TARIFF_MODE_VALUES.map((v) => ({
                value: v,
                label: TARIFF_MODE_LABELS[v],
              }))}
              triggerClassName="w-full"
            />
            <p className="text-muted-foreground text-xs">
              {tariffMode === 'grille_propre'
                ? 'Les courses de ce donneur seront tarifées avec sa grille propre (à définir ci-dessous après enregistrement).'
                : 'Les courses de ce donneur utilisent la grille CGSS de l’organisation.'}
            </p>
          </div>
          {/* Grille propre éditable uniquement en édition (besoin de l'id) ET si
              le mode enregistré est grille_propre. Sélectionner le mode puis
              enregistrer le donneur fait apparaître l'éditeur de grille. */}
          {initial && initial.tariff_mode === 'grille_propre' && (
            <OrderingPartyTariffForm partyId={initial.id} />
          )}
        </FormSection>

        {/* Disponibilité : ligne discrète séparée par un filet (pattern véhicule). */}
        <div className="border-border border-t pt-12">
          <label className="flex cursor-pointer items-center gap-12">
            <Checkbox name="actif" defaultChecked={initial?.actif ?? true} />
            <span className="text-sm">
              Donneur d&apos;ordres actif (proposé au rattachement d&apos;une course)
            </span>
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
              Archiver ce donneur d&apos;ordres
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
          : "Créer le donneur d'ordres"}
    </Button>
  );
}
