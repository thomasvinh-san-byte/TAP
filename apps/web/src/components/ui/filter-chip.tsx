'use client';

import * as React from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Puce de filtre (filter chip) — bouton toggle en forme de pilule, aligné sur la
 * norme Material 3 : compacte, coins arrondis pleins (`rounded-full`), libellé
 * court centré verticalement. C'est un vrai composant de filtre, pas un bouton
 * système détourné (d'où l'absence d'`outline-offset` qui créait un halo détaché).
 *
 * États :
 * - non sélectionné : pilule discrète (bordure fine + texte secondaire), survol
 *   sobre, aucune couleur vive ;
 * - sélectionné : couleur franche du thème (fond `primary` + texte contrasté) avec
 *   coche en tête → distinction immédiate.
 *
 * Accessibilité : bouton natif activable au clavier, `aria-pressed` pour l'état,
 * état perceptible au-delà de la couleur (coche + bordure). Focus visible net
 * (`focus-visible:ring`, SANS offset). Transition de couleur douce respectant
 * `prefers-reduced-motion` (`motion-safe:`).
 */
export const FilterChip = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }
>(({ selected, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-pressed={selected}
    className={cn(
      'inline-flex h-8 items-center gap-4 rounded-full px-12 text-sm font-medium',
      'focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
      'motion-safe:transition-colors motion-safe:duration-150',
      selected
        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground border',
      className,
    )}
    {...props}
  >
    {selected && <Check className="h-12 w-12" aria-hidden />}
    {children}
  </button>
));
FilterChip.displayName = 'FilterChip';
