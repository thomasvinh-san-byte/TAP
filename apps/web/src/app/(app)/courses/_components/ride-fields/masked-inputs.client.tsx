'use client';

import { type ChangeEvent, forwardRef } from 'react';
import { Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { digitsOnly, formatDateMask, formatTimeMask } from './datetime-helpers';

/**
 * Inputs masqués pour date (jj/mm/aaaa) et heure (hh:mm) — extraits de
 * `ride-express-form-fields.client.tsx` (Phase 06.27 lot 4).
 *
 * Auto-insertion des séparateurs / et : ; inputMode numeric pour clavier
 * régulateur et mobile. Utilisés via `customInput={<DateMaskedInput />}`
 * de react-datepicker.
 */

export interface MaskedFieldProps {
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onClick?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean | 'true' | 'false';
}

export const MASKED_FIELD_CLASS = cn(
  'h-10 w-full min-w-0 rounded-md border border-input bg-background pl-32 pr-32 py-8 text-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-50',
  'placeholder:text-muted-foreground',
  'aria-[invalid=true]:border-destructive',
);

export const DateMaskedInput = forwardRef<HTMLInputElement, MaskedFieldProps>(
  function DateMaskedInput(
    { value = '', onChange, onClick, onBlur, onFocus, placeholder, disabled, ariaInvalid },
    ref,
  ) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
      e.target.value = formatDateMask(digitsOnly(e.target.value));
      onChange?.(e);
    };
    return (
      <div className="relative w-full">
        <CalendarIcon
          className="text-muted-foreground pointer-events-none absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2"
          aria-hidden
        />
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={10}
          enterKeyHint="next"
          autoComplete="off"
          aria-label="Date"
          aria-invalid={ariaInvalid === 'true' || ariaInvalid === true || undefined}
          value={value}
          onChange={handleChange}
          onClick={onClick}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={MASKED_FIELD_CLASS}
        />
      </div>
    );
  },
);

export const TimeMaskedInput = forwardRef<HTMLInputElement, MaskedFieldProps>(
  function TimeMaskedInput(
    { value = '', onChange, onClick, onBlur, onFocus, placeholder, disabled, ariaInvalid },
    ref,
  ) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
      e.target.value = formatTimeMask(digitsOnly(e.target.value));
      onChange?.(e);
    };
    return (
      <div className="relative w-full">
        <ClockIcon
          className="text-muted-foreground pointer-events-none absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2"
          aria-hidden
        />
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={5}
          enterKeyHint="done"
          autoComplete="off"
          aria-label="Heure"
          aria-invalid={ariaInvalid === 'true' || ariaInvalid === true || undefined}
          value={value}
          onChange={handleChange}
          onClick={onClick}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={MASKED_FIELD_CLASS}
        />
      </div>
    );
  },
);
