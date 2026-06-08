'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * <Combobox> — combobox éditable accessible (Phase 06.17 D-04).
 *
 * Pattern W3C ARIA APG « Editable combobox with list autocomplete » : ARIA
 * combobox/listbox/option, clavier flèches/Enter/Échap/Tab, filtrage flou
 * (accents insensibles), saisie libre par défaut (`allowFreeText`).
 *
 * Stack figée DEC-003 (pas de Radix Popover/cmdk/floating-ui) : la listbox est
 * rendue DÉTACHÉE au `document.body` via `createPortal` (react-dom, 0 install),
 * en `position: fixed` ancrée au rect du champ (recalcul scroll/resize, flip
 * haut/bas). Le portail échappe au clipping/overflow et aux stacking contexts
 * des ancêtres (Phase 06.42, DEC-121) : la liste ne se superpose plus et passe
 * au-dessus des dialogs (address-picker dans le modal course). `onPointerDown`
 * stoppé pour ne pas fermer le Dialog Radix. Hint lié par `aria-describedby`.
 */

export interface ComboboxProps {
  id: string;
  /** Nom du champ pour la soumission de formulaire (FormData). */
  name?: string;
  label: string;
  options: readonly string[];
  /** Valeur contrôlée. */
  value: string;
  /** Callback de changement (saisie libre comme sélection). */
  onChange: (value: string) => void;
  /** Helper text persistant sous l'input. */
  hint?: React.ReactNode;
  error?: string;
  placeholder?: string;
  /** Si `true` (défaut), accepte toute saisie libre. Si `false`, force une option. */
  allowFreeText?: boolean;
  disabled?: boolean;
  /** Autofocus à l'ouverture. */
  autoFocus?: boolean;
}

interface ListboxPosition {
  left: number;
  width: number;
  anchor: number; // `top` si vers le bas, `bottom` si flip vers le haut
  flipUp: boolean;
  maxHeight: number;
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
  const listboxRef = React.useRef<HTMLUListElement>(null);

  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<ListboxPosition | null>(null);

  const filtered = React.useMemo(() => filterOptions(options, value), [options, value]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  // Position fixed ancrée au champ (recalcul ouverture/scroll/resize) ; flip haut/bas.
  const computePosition = React.useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const desired = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const flipUp = spaceBelow < desired && spaceAbove > spaceBelow;
    setPosition({
      left: rect.left,
      width: rect.width,
      flipUp,
      anchor: flipUp ? window.innerHeight - rect.top + gap : rect.bottom + gap,
      maxHeight: Math.max(120, Math.min(desired, (flipUp ? spaceAbove : spaceBelow) - gap - 8)),
    });
  }, []);

  React.useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    computePosition();
    const onScrollResize = (): void => computePosition();
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open, computePosition, filtered.length]);

  // Ferme au clic dehors (la listbox portalisée est hors du wrapper → on l'ignore aussi).
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent): void {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (listboxRef.current?.contains(target)) return;
      setOpen(false);
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

        {open && mounted && filtered.length > 0 && position
          ? createPortal(
              <ul
                ref={listboxRef}
                id={listboxId}
                role="listbox"
                // Stoppe la propagation : le DismissableLayer Radix ne ferme pas le Dialog.
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  left: position.left,
                  width: position.width,
                  maxHeight: position.maxHeight,
                  ...(position.flipUp ? { bottom: position.anchor } : { top: position.anchor }),
                }}
                className="border-border bg-popover text-popover-foreground z-[60] overflow-auto rounded-md border shadow-md"
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
              </ul>,
              document.body,
            )
          : null}
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
