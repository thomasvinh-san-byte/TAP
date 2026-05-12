'use client';

import { useCallback, useState } from 'react';
import { checkDuplicateRideAction } from '../actions';
import type { RideSubmitFormState } from './use-ride-submit.client';

/**
 * Hook B3 — détection doublon non-bloquante (Phase 03.1, D-B3-1..5 ;
 * Phase 03.1.1 retire le fallback parseFreeformDate suite à passage aux
 * inputs date+time natifs — `scheduled_at` est désormais toujours ISO).
 *
 * Encapsule le state `duplicates` + `duplicateConfirmed` et la pré-vérif
 * avant submit. Extrait du modal pour respecter CLAUDE.md § 11 (≤ 300 L).
 *
 * Flow :
 *   1. `runCheck(form, excludeRideId)` appelle `checkDuplicateRideAction`
 *      et retourne `true` si un doublon est détecté (le state `duplicates`
 *      est alors alimenté ; le caller doit return early pour laisser le
 *      banner s'afficher).
 *   2. `confirm()` → `setDuplicateConfirmed(true)`, le prochain `runCheck`
 *      sera bypassé via `bypass` explicite (cf. ride-express-modal).
 *   3. `reset()` → état propre à la réouverture du modal (D-B3-5).
 */
export function useDuplicateCheck() {
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; scheduled_at: string; status: string }>
  >([]);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const runCheck = useCallback(
    async (
      form: RideSubmitFormState,
      excludeRideId: string | undefined,
    ): Promise<boolean> => {
      const scheduledIso = form.scheduled_at;
      if (!form.patient_id || !scheduledIso) return false;
      const result = await checkDuplicateRideAction({
        patientId: form.patient_id,
        scheduledAt: scheduledIso,
        excludeRideId,
      });
      if (result.data && result.data.length > 0) {
        setDuplicates(result.data);
        return true;
      }
      return false;
    },
    [],
  );

  const confirm = useCallback(() => setDuplicateConfirmed(true), []);
  const cancel = useCallback(() => setDuplicates([]), []);
  const reset = useCallback(() => {
    setDuplicateConfirmed(false);
    setDuplicates([]);
  }, []);

  return {
    duplicates,
    duplicateConfirmed,
    runCheck,
    confirm,
    cancel,
    reset,
  };
}
