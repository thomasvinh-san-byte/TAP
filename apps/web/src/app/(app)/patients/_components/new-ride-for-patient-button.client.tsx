'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRideOrchestrator } from '../../courses/_components/ride-orchestrator-context.client';

/**
 * Bouton drawer patient : ouvre la saisie express pré-remplie pour ce
 * patient (Phase 3 / 03-G).
 *
 * Dispatch `OPEN_NEW` avec `patientId` — l'orchestrator récupère la valeur
 * dans la draft entry et la passe en `initialPatientId` à la modal. Le
 * drawer reste ouvert sous la modal (pattern Radix Dialog au-dessus de
 * Sheet — focus trap empilé).
 */
export function NewRideForPatientButton({
  patientId,
}: {
  patientId: string;
}): JSX.Element {
  const { dispatch } = useRideOrchestrator();
  return (
    <Button
      type="button"
      onClick={() => dispatch({ type: 'OPEN_NEW', patientId })}
      className="w-full gap-8"
    >
      <Plus className="h-16 w-16" aria-hidden />
      <span>Créer une course</span>
    </Button>
  );
}
