'use client';

import { useTransition } from 'react';

/**
 * Hook scaffold — Wave 0 Phase 03.1.
 *
 * Wave 1 (Plan 03.1-01) câblera l'appel à `getPatientRideDefaultsAction`
 * pour pré-remplir mode + urgence à partir des préférences patient. Pour
 * l'instant, `triggerForPatient` est un no-op qui respecte déjà les gardes
 * métier D-A2-4 (mode == 'taxi_conventionne') et D-A2-5 (pas en édition).
 */
type SmartDefaultsInput = {
  rideId: string | undefined;
  currentMode: string;
  currentUrgency: string;
  onApply: (mode: string, urgency: string) => void;
};

export function useSmartDefaults(input: SmartDefaultsInput) {
  const [, startTransition] = useTransition();

  async function triggerForPatient(_patientId: string): Promise<void> {
    // Scaffold no-op — Plan 03.1-01 ajoutera l'appel Server Action.
    if (input.rideId) return;
    if (input.currentMode !== 'taxi_conventionne') return;
    if (input.currentUrgency !== 'programmee') return;
    // TODO Plan 01 :
    //   startTransition(async () => {
    //     const r = await getPatientRideDefaultsAction(_patientId);
    //     if (r && !('error' in r)) input.onApply(r.mode, r.urgency);
    //   });
    void startTransition; // évite unused (sera utilisé en Plan 01)
  }

  return { triggerForPatient };
}
