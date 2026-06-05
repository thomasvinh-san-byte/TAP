'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRideOrchestrator } from './ride-orchestrator-context.client';

/**
 * Bouton CTA « + Nouvelle course » du sub-header /courses (Phase 3 / 03-D).
 *
 * Consomme `useRideOrchestrator()` exposé par `<RideExpressOrchestrator>`
 * monté dans `(app)/layout.tsx` et dispatch `OPEN_NEW` au click. Le raccourci
 * clavier équivalent (`Cmd/Ctrl+Shift+K`) est annoncé via aria-label pour
 * que l'E2E SAIS-02 et les utilisateurs clavier le découvrent.
 *
 * Sizing (fix 03-d-bis — débordement preview) :
 *   - `size="default"` (h-10 = 40px via default Tailwind) aligne verticalement
 *     sur les Inputs/Selects de la ligne de filtres juste en dessous.
 *   - `shrink-0` empêche le bouton de déborder du parent flex.
 *   - `w-full md:w-auto` : pleine largeur sous le titre en mobile, taille
 *     intrinsèque à partir de 768 px.
 */
export function HeaderNewRideButton(): JSX.Element {
  const { dispatch } = useRideOrchestrator();
  return (
    <Button
      type="button"
      variant="accent"
      onClick={() => dispatch({ type: 'OPEN_NEW' })}
      aria-label="Nouvelle course (Cmd/Ctrl+Shift+K)"
      className="w-full shrink-0 gap-8 md:w-auto"
    >
      <Plus className="h-16 w-16" aria-hidden />
      <span>Nouvelle course</span>
    </Button>
  );
}
