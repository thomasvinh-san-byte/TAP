import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * <Field> — composant champ de formulaire commun (Phase 06.17 D-01).
 *
 * Socle unique des formulaires : étiquette + contrôle + aide persistante +
 * erreur, reliés par `aria-describedby` (normes NN/G, Deque, Shopify Polaris,
 * USWDS).
 *
 * Doctrine :
 * - `hint` = helper text PERSISTANT sous le contrôle. Survit à la saisie.
 *   À utiliser dès que l'utilisateur a besoin d'une instruction pour réussir
 *   le champ (format attendu, bornes numériques, etc.). Lié via
 *   `aria-describedby`.
 * - `placeholder` = EXEMPLE de valeur uniquement (« AB-123-CD »). JAMAIS une
 *   reformulation du label ni une instruction critique (disparaît à la frappe).
 * - `name` explicite respecté (utile quand un `idPrefix` rend les `id` uniques
 *   mais le `name` reste celui attendu par la Server Action — cf. registre-fields).
 *
 * Deux modes :
 * - SAISIE SIMPLE (défaut) : rend un `<Input>` interne à partir des attributs
 *   HTML passés. Comportement historique, inchangé.
 * - CONTRÔLE ENFANT : si `children` (fonction) est fourni, <Field> encadre le
 *   contrôle rendu par l'appelant (sélecteur de date, saisie masquée, sélecteur
 *   d'adresse…) et lui transmet les attributs d'accessibilité (`id`,
 *   `aria-describedby`, `aria-invalid`, `aria-required`). Le cadre commun
 *   (étiquette, astérisque, aide, erreur) reste fourni par <Field>.
 *
 * Obligatoire (`required`, désactivé par défaut) : astérisque rouge en fin de
 * libellé, MASQUÉE aux lecteurs d'écran (l'information vient de `aria-required`,
 * sinon lecture « étoile » redondante) + `aria-required` sur le contrôle. La
 * couleur n'est jamais le seul indicateur : le symbole + la légende
 * (`RequiredFieldsLegend`) portent le sens. Le marquage est composé ici, sans
 * alourdir la primitive `<Label>` utilisée ailleurs.
 */

/** Attributs d'accessibilité transmis au contrôle enfant (mode contrôle enfant). */
export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
}

export interface FieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'id' | 'required' | 'children'
> {
  id: string;
  label: string;
  /** Helper text persistant sous le contrôle (lié par aria-describedby). */
  hint?: React.ReactNode;
  /** Message d'erreur sous le champ (lié par aria-describedby). */
  error?: string;
  /**
   * Marque le champ comme obligatoire : astérisque rouge (masquée aux lecteurs
   * d'écran) dans l'étiquette + `aria-required` sur le contrôle. Désactivé par
   * défaut (rendu strictement identique à l'existant).
   */
  required?: boolean;
  /**
   * Mode contrôle enfant : rend le contrôle fourni au lieu de la saisie simple
   * interne, en lui passant les attributs d'accessibilité. Absent → saisie
   * simple (`<Input>`), comportement par défaut inchangé.
   */
  children?: (control: FieldControlProps) => React.ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  name,
  children,
  ...rest
}: FieldProps): JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const effectiveName = name ?? id;

  const control: FieldControlProps = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': required ? true : undefined,
  };

  return (
    <div className="space-y-8">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {' '}
            *
          </span>
        ) : null}
      </Label>
      {children ? (
        children(control)
      ) : (
        <Input
          {...control}
          name={effectiveName}
          className={cn(error && 'border-destructive focus-visible:ring-destructive', className)}
          autoComplete="off"
          {...rest}
        />
      )}
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

/**
 * Légende à poser en tête d'un formulaire comportant des champs obligatoires
 * (« Les champs marqués d'un astérisque (*) sont obligatoires »). Cohérente
 * visuellement avec l'astérisque des champs (même rouge). L'astérisque de la
 * légende est décorative → masquée aux lecteurs d'écran (le mot « astérisque »
 * porte déjà le sens). À appliquer aux formulaires dans les lots suivants.
 */
export function RequiredFieldsLegend({ className }: { className?: string }): JSX.Element {
  return (
    <p className={cn('text-muted-foreground text-xs', className)}>
      Les champs marqués d’un astérisque (
      <span aria-hidden="true" className="text-destructive">
        *
      </span>
      ) sont obligatoires
    </p>
  );
}
