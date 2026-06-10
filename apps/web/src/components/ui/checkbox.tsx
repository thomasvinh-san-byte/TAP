import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * <Checkbox> — primitive case à cocher (Phase 06.60, DEC-139).
 *
 * Vrai `<input type="checkbox">` (clavier Tab + Espace, `name`/`value`/
 * `defaultChecked` conservés pour la soumission native), visuellement tokenisé :
 * carré 18px `rounded-[5px]`, bordure `border-input` décoché, fond `bg-primary`
 * + coche blanche coché, focus ring tokenisé. L'input réel couvre une cible
 * tactile de 24px (overlay transparent) ; le visuel 18px et la coche sont des
 * FRÈRES de l'input pilotés en `peer-checked`. Aucune dépendance.
 */
export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          ref={ref}
          className={cn(
            'peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-[5px]',
            'disabled:cursor-not-allowed',
            className,
          )}
          {...props}
        />
        {/* Boîte visuelle 18px (frère de l'input → peer-checked applicable). */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none h-[18px] w-[18px] rounded-[5px] border transition-colors',
            'border-input bg-background',
            'peer-checked:border-primary peer-checked:bg-primary',
            'peer-focus-visible:ring-ring peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
            'peer-disabled:opacity-50',
          )}
        />
        {/* Coche (frère de l'input), centrée par-dessus la boîte. */}
        <Check
          aria-hidden
          strokeWidth={3}
          className="text-primary-foreground pointer-events-none absolute h-[12px] w-[12px] opacity-0 peer-checked:opacity-100"
        />
      </span>
    );
  },
);
Checkbox.displayName = 'Checkbox';
