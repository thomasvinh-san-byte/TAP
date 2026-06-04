import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * <Field> — composant champ de formulaire commun (Phase 06.17 D-01).
 *
 * Pattern label + input + hint persistant + erreur, lié par
 * `aria-describedby` (helper text et erreur — normes NN/G, Deque,
 * Shopify Polaris, USWDS).
 *
 * Doctrine :
 * - `hint` = helper text PERSISTANT sous l'input. Survit à la saisie.
 *   À utiliser dès que l'utilisateur a besoin d'une instruction pour
 *   réussir le champ (format attendu, bornes numériques, etc.).
 *   Lié à l'input via `aria-describedby` (lecteur d'écran).
 * - `placeholder` = EXEMPLE de valeur uniquement (« AB-123-CD »).
 *   JAMAIS une reformulation du label ni une instruction critique
 *   (disparaît à la frappe — invisible quand l'utilisateur en a besoin).
 *
 * Remplace les `Field` redéfinis localement dans vehicle-form et
 * driver-form (Phase 06.17 D-01).
 */

export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id: string;
  label: string;
  /** Helper text persistant sous l'input (lié par aria-describedby). */
  hint?: React.ReactNode;
  /** Message d'erreur sous le champ (lié par aria-describedby). */
  error?: string;
}

export function Field({ id, label, hint, error, className, ...rest }: FieldProps): JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="space-y-8">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
        autoComplete="off"
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
