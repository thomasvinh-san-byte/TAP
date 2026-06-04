'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * <Combobox> — combobox éditable accessible (Phase 06.17 D-04).
 *
 * Pattern W3C ARIA Authoring Practices Guide (APG) « Editable combobox
 * with list autocomplete » :
 * - `role="combobox"` sur l'input, `aria-expanded`, `aria-controls`,
 *   `aria-autocomplete="list"`, `aria-activedescendant`.
 * - Listbox `role="listbox"`, options `role="option"` avec `aria-selected`.
 * - Clavier : flèches haut/bas, Enter, Échap, Tab pour fermer.
 * - Filtrage flou côté client (normalisation accents, includes case-insensitive).
 * - Saisie libre autorisée par défaut (`allowFreeText`) — valeur hors liste OK.
 *
 * Stack figée DEC-003 : pas de Radix Popover (absent), pas de cmdk.
 * Dropdown construit par positionnement absolu, encapsulé dans le wrapper
 * du champ (z-index ≥ 50). Aucune nouvelle dépendance npm.
 *
 * Doctrine du hint identique à `<Field>` (D-02) — l'helper text est
 * persistant, lié par `aria-describedby`.
 */

export interface ComboboxProps {
  id: string;
  /** Nom du champ pour la soumission de formulaire (FormData). */
  name?: string;
  label: string;
  /** Liste d'options proposées (libre de filtrer côté composant). */
  options: readonly string[];
  /** Valeur contrôlée. */
  value: string;
  /** Callback de changement (saisie libre comme sélection). */
  onChange: (value: string) => void;
  /** Helper text persistant sous l'input. */
  hint?: React.ReactNode;
  /** Message d'erreur sous le champ. */
  error?: string;
  /** Placeholder court (exemple de valeur). */
  placeholder?: string;
  /** Si `true` (défaut), accepte toute saisie libre. Si `false`, force une option. */
  allowFreeText?: boolean;
  /** Désactive le composant. */
  disabled?: boolean;
  /** Autofocus à l'ouverture. */
  autoFocus?: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function filterOptions(options: readonly string[], query: string): readonly string[] {
  if (!query) return options;
  const q = normalize(query);
  return options.filter((opt) => normalize(opt).includes(q));
}

export function Combobox({
  id,
  name,
  label,
  options,
  value,
  onChange,
  hint,
  error,
  placeholder,
  allowFreeText = true,
  disabled,
  autoFocus,
}: ComboboxProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const listboxId = `${id}-listbox`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => filterOptions(options, value), [options, value]);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  // Ferme au clic dehors.
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent): void {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function commit(option: string): void {
    onChange(option);
    setOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      if (open && activeIndex >= 0 && activeIndex < filtered.length) {
        e.preventDefault();
        const opt = filtered[activeIndex];
        if (opt !== undefined) commit(opt);
      } else if (!allowFreeText && filtered.length === 1) {
        e.preventDefault();
        const opt = filtered[0];
        if (opt !== undefined) commit(opt);
      }
      // sinon : laisse le formulaire submit (saisie libre)
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeOptionId =
    activeIndex >= 0 && activeIndex < filtered.length ? `${id}-opt-${activeIndex}` : undefined;

  return (
    <div className="space-y-8">
      <Label htmlFor={id}>{label}</Label>
      <div ref={wrapperRef} className="relative">
        <Input
          id={id}
          ref={inputRef}
          name={name ?? id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className={cn('pr-32', error && 'border-destructive focus-visible:ring-destructive')}
        />
        <button
          type="button"
          aria-label={open ? 'Fermer les suggestions' : 'Ouvrir les suggestions'}
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-8"
          disabled={disabled}
        >
          <ChevronDown
            className={cn('h-16 w-16 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>

        {open && filtered.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="border-border bg-popover text-popover-foreground absolute z-50 mt-4 max-h-[240px] w-full overflow-auto rounded-md border shadow-md"
          >
            {filtered.map((opt, i) => {
              const optionId = `${id}-opt-${i}`;
              const selected = opt === value;
              const active = i === activeIndex;
              return (
                <li
                  key={opt}
                  id={optionId}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => {
                    // mousedown plutôt que click pour devancer le blur
                    e.preventDefault();
                    commit(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    'cursor-pointer px-12 py-8 text-sm',
                    active && 'bg-muted',
                    selected && 'font-semibold',
                  )}
                >
                  {opt}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
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
