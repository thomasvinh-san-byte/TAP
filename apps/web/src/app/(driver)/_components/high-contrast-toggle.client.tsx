'use client';

import { Contrast } from 'lucide-react';
import { useHighContrast } from '@/lib/use-high-contrast.client';
import { cn } from '@/lib/utils';

/**
 * <HighContrastToggle> — bouton bascule mode contraste élevé chauffeur
 * (Phase 06.28, DEC-108 / DEC-014).
 *
 * Posé dans le header `(driver)/layout.tsx` à côté du badge de connexion.
 * Active une option de lisibilité pour le terrain (plein soleil, écran
 * incliné) en renforçant borders et texte muted via CSS vars (overrides
 * dans `globals.css` sous `[data-driver-contrast="high"]`).
 *
 * A11y :
 * - `aria-pressed` reflète l'état actuel
 * - cible tactile 40 px (alignée sur ConnectionStatusBadge et ThemeToggle)
 * - icône `aria-hidden` (le label porte le sens)
 */
export function HighContrastToggle({ className }: { className?: string }): JSX.Element {
  const { enabled, toggle } = useHighContrast();
  const label = enabled ? 'Désactiver le contraste élevé' : 'Activer le contraste élevé';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-muted',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'transition-colors duration-150',
        enabled && 'text-foreground bg-muted',
        className,
      )}
    >
      <Contrast className="h-16 w-16" aria-hidden />
    </button>
  );
}
