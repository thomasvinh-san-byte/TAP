import * as React from 'react';
import { Field, type FieldProps } from './field';

/**
 * <NumberField> — variante de `<Field>` pour saisies numériques bornées
 * (Phase 06.17 D-02).
 *
 * Doctrine :
 * - `type="text"` + `inputMode="numeric"` (entier) ou `"decimal"`
 *   (montants/distance) + `pattern` — JAMAIS `type="number"` (spinners
 *   + capture molette accidentelle, bug NN/G récurrent).
 * - Bornes `min`/`max` exposées pour la validation HTML5 + le hint.
 * - **Défaut cohérent** : si l'utilisateur n'a pas fourni `defaultValue`
 *   et que `min` est défini (> 0 ou explicite), on l'utilise comme
 *   défaut. Distingue 2 cas via la prop `kind` :
 *   - `counter` (défaut) — compteur (places, personnes, durée en
 *     années…). Démarre à la borne basse (`min` si défini, sinon
 *     `0`). Le champ n'est jamais vide.
 *   - `optional` — mesure optionnelle (cf. durée légale parfois vide).
 *     Démarre vide ; l'unité doit alors être dans le `hint` pour
 *     rendre l'omission explicite.
 *
 * Validation `min/max` côté Server Action (zod) **inchangée**.
 */

export type NumberFieldKind = 'counter' | 'optional';

export interface NumberFieldProps extends Omit<
  FieldProps,
  'type' | 'inputMode' | 'pattern' | 'defaultValue'
> {
  /** Borne basse incluse. */
  min?: number;
  /** Borne haute incluse. */
  max?: number;
  /** `counter` (défaut) — démarre à `min`. `optional` — démarre vide. */
  kind?: NumberFieldKind;
  /** Pour les décimaux (montants, distances). Force `inputMode="decimal"`. */
  step?: number | 'any';
  /**
   * Valeur initiale. Si absente et `kind="counter"`, l'auto-défaut
   * `min ?? 0` s'applique. Si `null` est passé explicitement,
   * traité comme « pas de valeur » (typique d'une ligne SQL nullable).
   */
  defaultValue?: number | string | null;
}

function resolveDefault(
  defaultValue: NumberFieldProps['defaultValue'],
  kind: NumberFieldKind,
  min: number | undefined,
): number | string | undefined {
  if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
    return defaultValue;
  }
  if (kind === 'optional') return undefined; // démarre vide volontairement
  // counter : démarre à la borne basse (ou 0 par défaut)
  return min ?? 0;
}

export function NumberField({
  kind = 'counter',
  min,
  max,
  step,
  defaultValue,
  ...rest
}: NumberFieldProps): JSX.Element {
  const effectiveDefault = resolveDefault(defaultValue, kind, min);
  const isDecimal = step !== undefined && step !== 1;
  const inputMode = isDecimal ? 'decimal' : 'numeric';
  // Pattern strict pour la validation HTML5 (entier numérique vs décimal
  // avec virgule ou point).
  const pattern = isDecimal ? '[0-9]+([.,][0-9]+)?' : '[0-9]*';

  return (
    <Field
      {...rest}
      type="text"
      inputMode={inputMode}
      pattern={pattern}
      // min/max ne s'appliquent pas à un input text — on les expose
      // toutefois en data-* pour traçabilité éventuelle. La validation
      // réelle est côté Server Action (zod).
      data-min={min}
      data-max={max}
      data-step={step}
      defaultValue={effectiveDefault}
    />
  );
}
