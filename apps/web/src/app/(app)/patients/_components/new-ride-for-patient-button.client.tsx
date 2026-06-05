'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRideOrchestrator } from '../../courses/_components/ride-orchestrator-context.client';

/**
 * Bouton « Créer une course pour ce patient » placé dans le footer du
 * drawer patient (Phase 3 / 03-G).
 *
 * Consomme `useRideOrchestrator()` exposé par `<RideExpressOrchestrator>`
 * monté dans `(app)/layout.tsx` et dispatch `OPEN_NEW` avec `patientId`.
 *
 * Le drawer patient (Sheet) reste ouvert au click — la modal saisie
 * express (Dialog) s'ouvre par-dessus avec le patient pré-sélectionné via
 * `initialPatientId` (pattern Radix Dialog au-dessus de Sheet : focus
 * trap empilé, Esc ferme la modal en premier).
 */
export function NewRideForPatientButton({ patientId }: { patientId: string }): JSX.Element {
  const { dispatch } = useRideOrchestrator();
  return (
    <Button
      type="button"
      variant="accent"
      onClick={() => dispatch({ type: 'OPEN_NEW', patientId })}
      className="w-full justify-center gap-8"
    >
      <Plus className="h-16 w-16" aria-hidden />
      <span>Créer une course pour ce patient</span>
    </Button>
  );
}
