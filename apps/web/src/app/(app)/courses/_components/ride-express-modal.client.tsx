'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseFreeformDate, rideExpressInputSchema } from '@tap/shared';
import {
  createRideAction,
  updateRideAction,
  upsertRideDraft,
} from '../actions';
import { getPatientByIdAction } from '../../patients/actions';
import { useRidePrefill } from './use-ride-prefill.client';
import { PatientPickerField } from './ride-patient-picker.client';
import {
  AddressField,
  DateFreeformField,
  ModeUrgencyFields,
  NotesField,
  SavingIndicator,
  type TransportMode,
  type Urgency,
} from './ride-express-form-fields.client';

/**
 * RideExpressModal — formulaire saisie express (Phase 2 / Wave 3).
 *
 * Implémente D-03..D-06 + DEC-005 :
 *   - Dialog Radix (focus trap + Esc + aria-modal automatiques)
 *   - PatientSearch Phase 1 réutilisé via PatientPickerField
 *   - Date freeform parsée onBlur via parseFreeformDate (TZ navigateur)
 *   - Auto-save 5 s + onBlur + onClose (Esc) via upsertRideDraft idempotent
 *   - Submit optimistic (close + toast immédiat) ; sur erreur restaure
 *     snapshot et toast erreur (Pitfall 3)
 *   - Tab order 1-8 : patient -> date -> pickup -> dropoff -> mode -> urgency
 *     -> notes -> submit
 */

type FormState = {
  patient_id?: string;
  scheduled_at?: string;
  dateInput?: string;
  pickup_address?: string;
  dropoff_address?: string;
  transport_mode?: TransportMode;
  urgency?: Urgency;
  notes_regulateur?: string;
};

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
  const [dateError, setDateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingState, setSavingState] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | undefined>(props.draftId);

  // Pré-chargement du ride en mode édition — extrait dans useRidePrefill
  // pour respecter la limite 300 lignes/fichier (CLAUDE.md § 11).
  useRidePrefill<FormState>(
    props.rideId,
    (next, label) => {
      setForm(next);
      if (label) setPatientLabel(label);
    },
    props.onClose,
    (r) => ({
      patient_id: r.patient_id,
      scheduled_at: r.scheduled_at,
      dateInput: '',
      pickup_address: r.pickup_address,
      dropoff_address: r.dropoff_address,
      transport_mode: r.transport_mode as TransportMode,
      urgency: r.urgency as Urgency,
      notes_regulateur: r.notes_regulateur ?? undefined,
    }),
  );

  // Auto-save flush (D-05) — n'envoie que si quelque chose a été saisi.
  // Désactivé en mode édition : on ne crée pas de brouillon, on modifie
  // une course existante au submit explicite.
  const flushSave = useCallback(
    async (payload: FormState): Promise<void> => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (isEditMode) return;
      if (
        !payload.patient_id &&
        !payload.pickup_address &&
        !payload.dropoff_address &&
        !payload.scheduled_at
      ) {
        return;
      }
      setSavingState('saving');
      const { dateInput: _ignored, ...persisted } = payload;
      const res = await upsertRideDraft({
        id: draftIdRef.current,
        payload: persisted,
        patient_id: payload.patient_id,
      });
      if ('error' in res) {
        setSavingState('error');
        toast.error('Sauvegarde impossible — réessai automatique');
        return;
      }
      if (!draftIdRef.current) {
        draftIdRef.current = res.id;
        props.onDraftIdResolved(res.id);
      }
      setSavingState('saved');
      setLastSavedAt(Date.now());
    },
    [props, isEditMode],
  );

  const scheduleSave = useCallback(
    (next: FormState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void flushSave(next), 5000);
    },
    [flushSave],
  );

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        scheduleSave(next);
        return next;
      });
      setFieldErrors((prev) => {
        // Cas spécifique : `dateInput` est la string libre saisie par
        // l'utilisateur ; le champ zod correspondant est `scheduled_at`.
        // On clear donc `scheduled_at` quand l'utilisateur retape la date.
        const errKey = (key as string) === 'dateInput' ? 'scheduled_at' : (key as string);
        if (!prev[errKey]) return prev;
        const { [errKey]: _omit, ...rest } = prev;
        return rest;
      });
    },
    [scheduleSave],
  );

  // Cleanup debounce on unmount (Pitfall 2)
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // Synchronise `patientLabel` quand le modal est ouvert avec un
  // `initialPatientId` (drawer patient → 03-G). Sans ce sync, l'utilisateur
  // verrait « Sélectionné : (vide) » alors que `form.patient_id` est bien
  // posé — confusion garantie. Une seule requête à la première ouverture,
  // pas de retry si la lecture échoue (RLS bloque → patient hors org).
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

  const handlePatientSelect = useCallback(
    (id: string, label: string) => {
      updateField('patient_id', id);
      setPatientLabel(label);
    },
    [updateField],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        void flushSave(form).then(() => props.onClose());
      }
    },
    [flushSave, form, props],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const next: FormState = { ...form };
      if (next.dateInput && !next.scheduled_at) {
        const parsed = parseFreeformDate(next.dateInput);
        if (!parsed.ok) {
          setDateError(parsed.reason);
          return;
        }
        next.scheduled_at = parsed.iso;
      }
      const validation = rideExpressInputSchema.safeParse({
        patient_id: next.patient_id,
        scheduled_at: next.scheduled_at,
        pickup_address: next.pickup_address,
        dropoff_address: next.dropoff_address,
        transport_mode: next.transport_mode ?? 'taxi_conventionne',
        urgency: next.urgency ?? 'programmee',
        notes_regulateur: next.notes_regulateur,
      });
      if (!validation.success) {
        const flat = validation.error.flatten().fieldErrors;
        const collected: Record<string, string> = {};
        for (const [k, v] of Object.entries(flat)) {
          if (v && v[0]) collected[k] = v[0];
        }
        setFieldErrors(collected);
        toast.error('Vérifiez les champs obligatoires.');
        return;
      }
      setFieldErrors({});
      const optimisticLabel = isEditMode
        ? 'Course modifiée'
        : patientLabel
          ? `Course créée pour ${patientLabel}`
          : 'Course créée';
      toast.success(optimisticLabel);
      const snapshot = next;
      const targetRideId = props.rideId;
      startTransition(async () => {
        const res = targetRideId
          ? await updateRideAction({
              rideId: targetRideId,
              input: validation.data,
            })
          : await createRideAction({
              input: validation.data,
              fromDraftId: draftIdRef.current,
            });
        if (res.error) {
          toast.error(`Échec — saisie restaurée (${res.error})`);
          setForm(snapshot);
          return;
        }
        props.onClose();
      });
    },
    [form, patientLabel, props, isEditMode],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[600px]"
        aria-label="Saisie express d'une course"
      >
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Modifier la course' : 'Nouvelle course'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-16" noValidate>
          <PatientPickerField
            selectedLabel={patientLabel}
            onSelect={handlePatientSelect}
            error={fieldErrors.patient_id}
          />

          <DateFreeformField
            value={form.dateInput ?? ''}
            onChange={(v) => updateField('dateInput', v)}
            onParsed={(iso) => updateField('scheduled_at', iso)}
            error={dateError ?? fieldErrors.scheduled_at ?? null}
            onError={setDateError}
          />

          <AddressField
            id="pickup"
            label="Adresse de prise en charge"
            ariaLabel="Adresse de prise en charge"
            value={form.pickup_address ?? ''}
            onChange={(v) => updateField('pickup_address', v)}
            onBlur={() => void flushSave(form)}
            tabIndex={3}
            error={fieldErrors.pickup_address}
          />

          <AddressField
            id="dropoff"
            label="Adresse de destination"
            ariaLabel="Adresse de destination"
            value={form.dropoff_address ?? ''}
            onChange={(v) => updateField('dropoff_address', v)}
            onBlur={() => void flushSave(form)}
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
            onBlur={() => void flushSave(form)}
          />

          {!isEditMode && (
            <div className="text-xs text-muted-foreground min-h-[20px]">
              <SavingIndicator state={savingState} lastSavedAt={lastSavedAt} />
            </div>
          )}

          <DialogFooter>
            {!isEditMode && (
              <Button type="button" variant="ghost" onClick={props.onMinimize}>
                Mettre en pause
              </Button>
            )}
            <Button type="submit" disabled={isPending} tabIndex={8}>
              {isPending
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
