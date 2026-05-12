'use client';

import { useCallback, useTransition } from 'react';
import { toast } from 'sonner';
import { parseFreeformDate, rideExpressInputSchema } from '@tap/shared';
import { createRideAction, updateRideAction } from '../actions';
import type { TransportMode, Urgency } from './ride-express-form-fields.client';

/**
 * Submit du modal saisie express — extrait pour respecter CLAUDE.md § 11.
 *
 * Pattern : validation zod → toast optimiste → Server Action.
 * En cas d'échec, restaure le snapshot via `onRestore` (Pitfall 3).
 */
export type RideSubmitFormState = {
  patient_id?: string;
  scheduled_at?: string;
  dateInput?: string;
  pickup_address?: string;
  dropoff_address?: string;
  transport_mode?: TransportMode;
  urgency?: Urgency;
  notes_regulateur?: string;
};

export function useRideSubmit(args: {
  isEditMode: boolean;
  rideId: string | undefined;
  patientLabel: string;
  draftIdRef: { current: string | undefined };
  onSuccess: () => void;
  onRestore: (snapshot: RideSubmitFormState) => void;
  onDateError: (msg: string) => void;
  onFieldErrors: (errors: Record<string, string>) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(
    (form: RideSubmitFormState) => {
      const next: RideSubmitFormState = { ...form };
      if (next.dateInput && !next.scheduled_at) {
        const parsed = parseFreeformDate(next.dateInput);
        if (!parsed.ok) {
          args.onDateError(parsed.reason);
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
        args.onFieldErrors(collected);
        toast.error('Vérifiez les champs obligatoires.');
        return;
      }
      args.onFieldErrors({});
      const optimisticLabel = args.isEditMode
        ? 'Course modifiée'
        : args.patientLabel
          ? `Course créée pour ${args.patientLabel}`
          : 'Course créée';
      toast.success(optimisticLabel);
      const snapshot = next;
      const targetRideId = args.rideId;
      startTransition(async () => {
        const res = targetRideId
          ? await updateRideAction({
              rideId: targetRideId,
              input: validation.data,
            })
          : await createRideAction({
              input: validation.data,
              fromDraftId: args.draftIdRef.current,
            });
        if (res.error) {
          toast.error(`Échec — saisie restaurée (${res.error})`);
          args.onRestore(snapshot);
          return;
        }
        args.onSuccess();
      });
    },
    [args],
  );

  return { isPending, submit };
}
