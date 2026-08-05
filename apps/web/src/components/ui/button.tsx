import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Convention de hiérarchie des boutons.
 *
 * Un rôle par variante ; la couleur porte la hiérarchie mais jamais seule
 * (toujours un libellé clair, icône si utile) :
 *
 *   - `accent`         ACTION PRINCIPALE d'un écran ou d'une étape (valider un
 *                      formulaire, créer, confirmer une action constructive).
 *                      Au plus UNE action principale par écran ou par étape.
 *   - `outline`        Actions SECONDAIRES (Annuler, Retour, Filtrer, Exporter).
 *   - `destructive`    Actions DESTRUCTIVES (Supprimer, Désactiver, Archiver,
 *                      Retirer). Séparées des actions constructives ; une
 *                      confirmation destructive n'est jamais une simple action
 *                      principale d'accent. L'annulation reste en `outline`.
 *   - `ghost` / `link` Actions TERTIAIRES ou de faible priorité.
 *
 * `default` (fond `bg-primary`) n'est PAS l'action principale de l'application :
 * c'est un fond plein neutre, quasi inutilisé. Un bouton d'action principale
 * doit préciser `variant="accent"` explicitement — ne pas se reposer sur la
 * variante par défaut, qui donnerait un « mauvais principal ». (Le renommage
 * éventuel de `default` est un sujet distinct, hors de cette convention.)
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-muted hover:text-foreground',
        secondary: 'bg-muted text-foreground hover:bg-muted/80',
        ghost: 'hover:bg-muted hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-16 py-8',
        sm: 'h-8 rounded-md px-12',
        lg: 'h-12 rounded-md px-24',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
