'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * <PasswordInput> — champ mot de passe avec toggle afficher/masquer
 * accessible (Phase 06.18 D-01).
 *
 * Norme UX login (NN/G, muz.li 2026) : un des 4 problèmes UX majeurs
 * d'écrans login est l'impossibilité de vérifier ce qui a été tapé. Le
 * toggle visibilité doit être :
 * - Masqué par défaut (`type="password"`).
 * - Bouton dans le champ (pas un lien externe).
 * - Accessible clavier (focusable, pas `tabindex={-1}`).
 * - `aria-label` parlant + `aria-pressed` pour l'état.
 * - Non destructif : ne perd ni la valeur ni le focus.
 *
 * Composant client (gère un `useState` local pour le mode).
 * Réutilisable : login-form, accept-invite-form, tout formulaire avec
 * mot de passe.
 *
 * Hérite de tous les attributs `<Input>` (autoComplete, required,
 * defaultValue, etc.) sauf `type` (forcé à password/text en interne).
 */

export type PasswordInputProps = Omit<InputProps, 'type'>;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...rest }, ref) {
    const [visible, setVisible] = React.useState(false);
    const Icon = visible ? EyeOff : Eye;
    const label = visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe';

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-40', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={label}
          aria-pressed={visible}
          title={label}
          className={cn(
            'absolute inset-y-0 right-0 inline-flex w-32 items-center justify-center',
            'text-muted-foreground hover:text-foreground',
            'focus-visible:ring-ring rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
            'transition-colors duration-150',
          )}
        >
          <Icon className="h-16 w-16" aria-hidden />
        </button>
      </div>
    );
  },
);
