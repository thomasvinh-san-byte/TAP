'use client';

import { ALargeSmall } from 'lucide-react';
import { useDriverFontScale } from '@/lib/use-driver-font-scale.client';
import { cn } from '@/lib/utils';

/**
 * <FontScaleToggle> — bascule « police agrandie » chauffeur (PWA-04, §5.16).
 *
 * Posé dans le header `(driver)/layout.tsx` à côté du contraste élevé. Agrandit
 * la police d'un cran (+20 %) pour la lisibilité terrain. Même patron que
 * `HighContrastToggle` : préférence persistée localement, attribut sur `<html>`.
 *
 * A11y : `aria-pressed` reflète l'état, cible tactile 40 px, icône `aria-hidden`.
 */
export function FontScaleToggle({ className }: { className?: string }): JSX.Element {
  const { enlarged, toggle } = useDriverFontScale();
  const label = enlarged ? 'Rétablir la taille de police' : 'Agrandir la police';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={enlarged}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-muted',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'transition-colors duration-150',
        enlarged && 'text-foreground bg-muted',
        className,
      )}
    >
      <ALargeSmall className="h-16 w-16" aria-hidden />
    </button>
  );
}
