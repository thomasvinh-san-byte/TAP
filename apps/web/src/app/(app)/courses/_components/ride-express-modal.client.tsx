'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getPatientByIdAction } from '../../patients/actions';
import { useRidePrefill } from './use-ride-prefill.client';
import { useRideAutosave } from './use-ride-autosave.client';
import { useRideSubmit, type RideSubmitFormState } from './use-ride-submit.client';
import { useSmartDefaults } from './use-smart-defaults.client';
import { useDuplicateCheck } from './use-duplicate-check.client';
import { DuplicateBanner } from './duplicate-banner.client';
import { PatientPickerField } from './ride-patient-picker.client';
import { OrderingPartyPickerField } from './ride-ordering-party-picker.client';
import { PrescriptionPickerField } from './ride-prescription-picker.client';
import { AddressOrPOIPicker } from './address-or-poi-picker.client';
import {
  DateTimeFields,
  ModeUrgencyFields,
  NotesField,
  SavingIndicator,
  type TransportMode,
  type Urgency,
} from './ride-fields';

/**
 * RideExpressModal — formulaire saisie express (Phase 2 / Wave 3 ; décompressé
 * Wave 0 phase 03.1 via useRideAutosave + useRideSubmit). Implémente D-03..D-06
 * + DEC-005 : Dialog Radix, PatientSearch, date freeform parsée onBlur,
 * auto-save 5s/onBlur/onClose, submit optimistic + restore snapshot.
 *
 * Pattern modale (DEC-106 §5bis) : `Dialog` centré — création focalisée,
 * l'utilisateur ne consulte rien d'autre pendant la saisie.
 */

type FormState = RideSubmitFormState;

interface Props {
  tempKey: string;
  draftId?: string;
  initialPatientId?: string;
  /**
   * Si présent : mode édition d'une course existante. Le modal pré-charge
   * les valeurs via `getRideByIdAction`, désactive l'auto-save brouillon
   * et appelle `updateRideAction` au lieu de `createRideAction` au submit.
   */
  rideId?: string;
  onClose: () => void;
  onMinimize: () => void;
  onDraftIdResolved: (id: string) => void;
}

export function RideExpressModal(props: Props): JSX.Element {
  const isEditMode = Boolean(props.rideId);
  const [form, setForm] = useState<FormState>({
    patient_id: props.initialPatientId,
    transport_mode: 'taxi_conventionne',
    urgency: 'programmee',
  });
  const [patientLabel, setPatientLabel] = useState<string>('');
  const [orderingPartyLabel, setOrderingPartyLabel] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // B3 — détection doublon non-bloquante (D-B3-1..5).
  const dup = useDuplicateCheck();

  const autosave = useRideAutosave<FormState>({
    isEditMode,
    initialDraftId: props.draftId,
    onDraftIdResolved: props.onDraftIdResolved,
  });

  // Pré-chargement du ride en mode édition — extrait dans useRidePrefill.
  useRidePrefill<FormState>(
    props.rideId,
    (next, label, orderingLabel) => {
      setForm(next);
      if (label) setPatientLabel(label);
      if (orderingLabel) setOrderingPartyLabel(orderingLabel);
    },
    props.onClose,
    (r) => ({
      patient_id: r.patient_id,
      scheduled_at: r.scheduled_at,
      pickup_address: r.pickup_address,
      dropoff_address: r.dropoff_address,
      transport_mode: r.transport_mode as TransportMode,
      urgency: r.urgency as Urgency,
      notes_regulateur: r.notes_regulateur ?? undefined,
      ordering_party_id: r.ordering_party_id ?? null,
      prescription_id: (r as { prescription_id?: string | null }).prescription_id ?? null,
    }),
  );

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        autosave.scheduleSave(next);
        return next;
      });
      setFieldErrors((prev) => {
        const errKey = key as string;
        if (!prev[errKey]) return prev;
        const { [errKey]: _omit, ...rest } = prev;
        return rest;
      });
    },
    [autosave],
  );

  // Synchronise `patientLabel` quand le modal est ouvert avec un
  // `initialPatientId` (drawer patient → 03-G). Sans ce sync, l'utilisateur
  // verrait « Sélectionné : (vide) » alors que `form.patient_id` est posé.
  const initialPatientId = props.initialPatientId;
  useEffect(() => {
    if (!initialPatientId || patientLabel) return;
    let cancelled = false;
    void getPatientByIdAction(initialPatientId)
      .then((p) => {
        if (cancelled || !p) return;
        const nom = (p as { nom?: string | null }).nom ?? '';
        const prenom = (p as { prenom?: string | null }).prenom ?? '';
        const label = `${prenom} ${nom}`.trim();
        if (label) setPatientLabel(label);
      })
      .catch(() => {
        /* lecture impossible — label vide, pas bloquant */
      });
    return () => {
      cancelled = true;
    };
  }, [initialPatientId, patientLabel]);

  // Smart defaults (A2, Plan 03.1-01) : pré-remplit silencieusement mode +
  // urgence depuis la dernière course du patient. Gardes D-A2-4 / D-A2-5
  // appliquées DANS le hook (pas besoin de les répéter ici).
  const smartDefaults = useSmartDefaults({
    rideId: props.rideId,
    currentMode: form.transport_mode ?? 'taxi_conventionne',
    currentUrgency: form.urgency ?? 'programmee',
    onApply: (mode, urgency) => {
      updateField('transport_mode', mode as TransportMode);
      updateField('urgency', urgency as Urgency);
    },
  });

  const handlePatientSelect = useCallback(
    (id: string, label: string) => {
      updateField('patient_id', id);
      setPatientLabel(label);
      // A2 silent prefill (D-A2-1) — pas de toast, pas de spinner.
      void smartDefaults.triggerForPatient(id);
    },
    [updateField, smartDefaults],
  );

  const handleOrderingPartySelect = useCallback(
    (id: string | null, label: string) => {
      updateField('ordering_party_id', id);
      setOrderingPartyLabel(label);
    },
    [updateField],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) void autosave.flushSave(form).then(() => props.onClose());
    },
    [autosave, form, props],
  );

  const submit = useRideSubmit({
    isEditMode,
    rideId: props.rideId,
    patientLabel,
    draftIdRef: autosave.draftIdRef,
    onSuccess: () => {
      dup.reset(); // D-B3-5 : reset AVANT onClose
      props.onClose();
    },
    onRestore: setForm,
    onFieldErrors: setFieldErrors,
  });

  // Pré-vérif doublon (D-B3-3) puis submit normal.
  const runSubmit = useCallback(
    async (bypass: boolean) => {
      if (!bypass && (await dup.runCheck(form, props.rideId))) return;
      submit.submit(form);
    },
    [dup, form, props.rideId, submit],
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      void runSubmit(dup.duplicateConfirmed);
    },
    [runSubmit, dup.duplicateConfirmed],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100vw-32px)] max-w-[640px] overflow-y-auto overflow-x-hidden"
        aria-label="Saisie express d'une course"
      >
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Modifier la course' : 'Nouvelle course'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-12" noValidate>
          <PatientPickerField
            selectedLabel={patientLabel}
            onSelect={handlePatientSelect}
            error={fieldErrors.patient_id}
          />

          <OrderingPartyPickerField
            selectedId={form.ordering_party_id ?? null}
            selectedLabel={orderingPartyLabel}
            onSelect={handleOrderingPartySelect}
            error={fieldErrors.ordering_party_id}
          />

          <PrescriptionPickerField
            patientId={form.patient_id}
            selectedId={form.prescription_id ?? null}
            onSelect={(id) => updateField('prescription_id', id)}
          />

          <DateTimeFields
            value={form.scheduled_at ?? null}
            onChange={(iso) => updateField('scheduled_at', iso ?? undefined)}
            onBlur={() => void autosave.flushSave(form)}
            error={fieldErrors.scheduled_at ?? null}
          />

          <AddressOrPOIPicker
            id="pickup"
            label="Adresse de prise en charge"
            ariaLabel="Adresse de prise en charge"
            value={form.pickup_address ?? ''}
            onChange={(v) => updateField('pickup_address', v)}
            onSelect={(sel) => {
              // DEC-044 : threadage coords BAN/POI → persistance Server Action
              updateField('pickup_lat' as keyof FormState, (sel.lat ?? null) as never);
              updateField('pickup_lng' as keyof FormState, (sel.lng ?? null) as never);
              updateField('pickup_citycode' as keyof FormState, (sel.citycode ?? null) as never);
            }}
            onBlur={() => void autosave.flushSave(form)}
            tabIndex={3}
            error={fieldErrors.pickup_address}
          />

          <AddressOrPOIPicker
            id="dropoff"
            label="Adresse de destination"
            ariaLabel="Adresse de destination"
            value={form.dropoff_address ?? ''}
            onChange={(v) => updateField('dropoff_address', v)}
            onSelect={(sel) => {
              updateField('dropoff_lat' as keyof FormState, (sel.lat ?? null) as never);
              updateField('dropoff_lng' as keyof FormState, (sel.lng ?? null) as never);
              updateField('dropoff_citycode' as keyof FormState, (sel.citycode ?? null) as never);
            }}
            onBlur={() => void autosave.flushSave(form)}
            tabIndex={4}
            error={fieldErrors.dropoff_address}
          />

          <ModeUrgencyFields
            mode={form.transport_mode ?? 'taxi_conventionne'}
            urgency={form.urgency ?? 'programmee'}
            onModeChange={(m) => updateField('transport_mode', m)}
            onUrgencyChange={(u) => updateField('urgency', u)}
          />

          <NotesField
            value={form.notes_regulateur ?? ''}
            onChange={(v) => updateField('notes_regulateur', v)}
            onBlur={() => void autosave.flushSave(form)}
          />

          {!isEditMode && (
            <div className="text-muted-foreground min-h-[20px] text-xs">
              <SavingIndicator state={autosave.savingState} lastSavedAt={autosave.lastSavedAt} />
            </div>
          )}

          <DuplicateBanner
            duplicates={dup.duplicates}
            isPending={submit.isPending}
            onCancel={dup.cancel}
            onConfirm={() => {
              dup.confirm();
              void runSubmit(true); // bypass explicite (state lu au render suivant)
            }}
          />

          <DialogFooter>
            {!isEditMode && (
              <Button type="button" variant="ghost" onClick={props.onMinimize}>
                Mettre en pause
              </Button>
            )}
            <Button type="submit" variant="accent" disabled={submit.isPending} tabIndex={8}>
              {submit.isPending
                ? isEditMode
                  ? 'Enregistrement…'
                  : 'Création…'
                : isEditMode
                  ? 'Enregistrer les modifications'
                  : 'Créer la course'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
