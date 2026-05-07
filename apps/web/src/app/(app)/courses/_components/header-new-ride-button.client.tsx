'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRideOrchestrator } from './ride-orchestrator-context.client';

/**
 * Bouton header global « + Nouvelle course » (Phase 2 / Wave 4).
 *
 * Consomme `useRideOrchestrator()` exposé par `<RideExpressOrchestrator>`
 * monté dans `(app)/layout.tsx` et dispatch `OPEN_NEW` au click. Le raccourci
 * clavier équivalent (`Cmd/Ctrl+Shift+K`) est annoncé via aria-label pour
 * que l'E2E SAIS-02 et les utilisateurs clavier le découvrent.
 */
export function HeaderNewRideButton(): JSX.Element {
  const { dispatch } = useRideOrchestrator();
  return (
    <Button
      type="button"
      variant="default"
      size="sm"
      onClick={() => dispatch({ type: 'OPEN_NEW' })}
      aria-label="Nouvelle course (Cmd/Ctrl+Shift+K)"
      className="gap-8"
    >
      <Plus className="h-16 w-16" aria-hidden />
      <span>Nouvelle course</span>
    </Button>
  );
}
