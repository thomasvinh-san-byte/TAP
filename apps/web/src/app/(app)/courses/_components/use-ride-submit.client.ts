'use client';

import { useCallback, useTransition } from 'react';
import { toast } from 'sonner';
import { rideExpressInputSchema } from '@tap/shared';
import { createRideAction, updateRideAction } from '../actions';
import type { TransportMode, Urgency } from './ride-fields';

/**
 * Submit du modal saisie express — extrait pour respecter CLAUDE.md § 11.
 *
 * Pattern : validation zod → toast optimiste → Server Action.
 * En cas d'échec, restaure le snapshot via `onRestore` (Pitfall 3).
 * `scheduled_at` est déjà ISO 8601 (set par DateTimeFields, Phase 03.1.1) —
 * plus de fallback `parseFreeformDate` depuis le retrait de DateFreeformField.
 */
export type RideSubmitFormState = {
  patient_id?: string;
  scheduled_at?: string;
  pickup_address?: string;
  dropoff_address?: string;
  /** Coords géocoding DEC-044 (Phase 04.7) — null si saisie libre hors BAN/POI */
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  pickup_citycode?: string | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  dropoff_citycode?: string | null;
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
  onFieldErrors: (errors: Record<string, string>) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const submit = useCallback(
    (form: RideSubmitFormState) => {
      const next: RideSubmitFormState = { ...form };
      const validation = rideExpressInputSchema.safeParse({
        patient_id: next.patient_id,
        scheduled_at: next.scheduled_at,
        pickup_address: next.pickup_address,
        dropoff_address: next.dropoff_address,
        pickup_lat: next.pickup_lat,
        pickup_lng: next.pickup_lng,
        pickup_citycode: next.pickup_citycode,
        dropoff_lat: next.dropoff_lat,
        dropoff_lng: next.dropoff_lng,
        dropoff_citycode: next.dropoff_citycode,
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
          toast.error(`Échec : saisie restaurée (${res.error})`);
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
