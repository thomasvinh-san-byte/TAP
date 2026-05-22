'use client';

import { useState } from 'react';
import { format, isValid, parse } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Champ de saisie de date au format français JJ/MM/AAAA garanti.
 *
 * L'input natif `<input type="date">` affiche le format selon la locale du
 * système de l'utilisateur (MM/DD/YYYY en anglais) — aucun attribut HTML ne
 * le force (même limitation que `type="time"`). Ce composant est un champ
 * texte masqué : affichage français partout.
 *
 * La valeur exposée (hidden input `name` + `onChange`) reste ISO
 * `YYYY-MM-DD` — aucun impact sur la validation Zod, les actions ou le
 * stockage. Le contrôle local de validité est un garde-fou UX : la validation
 * serveur reste la source de vérité.
 */

const ISO_FMT = 'yyyy-MM-dd';
const FR_FMT = 'dd/MM/yyyy';

function isoToFr(iso: string): string {
  if (!iso) return '';
  const d = parse(iso, ISO_FMT, new Date());
  return isValid(d) ? format(d, FR_FMT) : '';
}

/** JJ/MM/AAAA → { iso, valid }. Saisie vide ou incomplète → iso vide. */
function frToParts(fr: string): { iso: string; valid: boolean } {
  if (fr.length === 0) return { iso: '', valid: true };
  if (fr.length !== 10) return { iso: '', valid: false };
  const d = parse(fr, FR_FMT, new Date());
  if (!isValid(d) || format(d, FR_FMT) !== fr) return { iso: '', valid: false };
  return { iso: format(d, ISO_FMT), valid: true };
}

/** Insère les « / » au fil de la frappe ; ne conserve que les chiffres. */
function applyMask(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

interface DateFieldFrProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  ariaLabel?: string;
  autoComplete?: string;
}

export function DateFieldFr({
  id,
  name,
  value,
  defaultValue,
  onChange,
  required,
  disabled,
  min,
  max,
  className,
  ariaLabel,
  autoComplete,
}: DateFieldFrProps): JSX.Element {
  const [display, setDisplay] = useState(() => isoToFr(value ?? defaultValue ?? ''));
  const [lastValue, setLastValue] = useState(value);

  // Resynchronise l'affichage si la valeur contrôlée change de l'extérieur,
  // sans effacer une saisie partielle en cours.
  if (value !== undefined && value !== lastValue) {
    setLastValue(value);
    if (value !== frToParts(display).iso) setDisplay(isoToFr(value));
  }

  const inRange = (iso: string): boolean => !iso || ((!min || iso >= min) && (!max || iso <= max));

  const parts = frToParts(display);
  const showError = display.length === 10 && (!parts.valid || !inRange(parts.iso));
  const emittedIso = parts.valid && inRange(parts.iso) ? parts.iso : '';

  function handleChange(raw: string): void {
    const masked = applyMask(raw);
    setDisplay(masked);
    const next = frToParts(masked);
    onChange?.(next.valid && inRange(next.iso) ? next.iso : '');
  }

  return (
    <div className="space-y-4">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        maxLength={10}
        placeholder="jj/mm/aaaa"
        value={display}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        aria-invalid={showError || undefined}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(showError && 'border-destructive', className)}
      />
      {name ? <input type="hidden" name={name} value={emittedIso} /> : null}
      {showError ? (
        <p className="text-destructive text-xs">Date invalide (format attendu : jj/mm/aaaa).</p>
      ) : null}
    </div>
  );
}
