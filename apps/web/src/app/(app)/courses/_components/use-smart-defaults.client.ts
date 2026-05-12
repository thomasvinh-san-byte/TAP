'use client';

import { getPatientRideDefaultsAction } from '@/app/(app)/patients/actions';

/**
 * Hook smart defaults — Plan 03.1-01 (A2 silent prefill).
 *
 * Pré-remplit `transport_mode` + `urgency` à partir de la dernière course
 * non archivée du patient sélectionné, UNIQUEMENT si le formulaire est
 * encore aux défauts V1 (D-A2-4) ET hors mode édition (D-A2-5).
 *
 * Décisions locked (cf. 03.1-CONTEXT.md) :
 *  - D-A2-1 : pré-remplissage SILENCIEUX — aucun toast, aucun spinner,
 *    aucun état isPending visible. Donc PAS de `startTransition` wrap
 *    (checker W6). Simple `await` ; la modal bloque un tick côté JS
 *    mais aucune UI ne reflète ce délai.
 *  - D-A2-4 : n'écrase QUE si `mode === 'taxi_conventionne'` ET
 *    `urgency === 'programmee'` (défauts V1).
 *  - D-A2-5 : désactivé si `rideId` présent (mode édition).
 *
 * Les erreurs Server Action sont silencieusement ignorées : le pré-
 * remplissage est non-critique (Doctolib quick booking pattern).
 */
type SmartDefaultsInput = {
  rideId: string | undefined;
  currentMode: string;
  currentUrgency: string;
  onApply: (mode: string, urgency: string) => void;
};

export function useSmartDefaults(input: SmartDefaultsInput) {
  async function triggerForPatient(patientId: string): Promise<void> {
    if (input.rideId) return; // D-A2-5
    if (input.currentMode !== 'taxi_conventionne') return; // D-A2-4
    if (input.currentUrgency !== 'programmee') return; // D-A2-4
    const result = await getPatientRideDefaultsAction(patientId); // D-A2-1 (no startTransition)
    if (!result?.data) return;
    input.onApply(result.data.transport_mode, result.data.urgency); // D-A2-3
  }
  return { triggerForPatient };
}
