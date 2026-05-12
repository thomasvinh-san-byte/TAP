'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * Select minimaliste — wrapper Radix DropdownMenu en attendant l'install
 * officielle de @radix-ui/react-select (économie de dépendance V1, DEC-005
 * + CLAUDE.md § 13 « pas de nouvelle dépendance sans justification »).
 *
 * API contrôlée :
 *   <Select value="all" onChange={setX} items={[{value, label}]} />
 *
 * Comportement :
 *   - Trigger Button-like avec chevron à droite
 *   - Items checkable, check Lucide sur la sélection courante
 *   - Largeur min définissable via `triggerClassName`
 *   - aria-label requis (a11y — pas de <label> implicite)
 */
export interface SelectItem {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (next: string) => void;
  items: SelectItem[];
  ariaLabel: string;
  /** Texte affiché quand aucune valeur n'est sélectionnée. */
  placeholder?: string;
  triggerClassName?: string;
  contentClassName?: string;
  /** Affichage personnalisé d'un item dans la liste (icône, badge…). */
  renderItem?: (item: SelectItem) => React.ReactNode;
}

export function Select({
  value,
  onChange,
  items,
  ariaLabel,
  placeholder,
  triggerClassName,
  contentClassName,
  renderItem,
}: SelectProps): JSX.Element {
  const current = items.find((i) => i.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-40 items-center justify-between gap-8 rounded-md border border-input bg-background px-12 text-sm',
          'transition-colors duration-150 hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'data-[state=open]:ring-2 data-[state=open]:ring-ring data-[state=open]:ring-offset-2 data-[state=open]:ring-offset-background',
          triggerClassName,
        )}
      >
        <span className={cn('truncate', !current && 'text-muted-foreground')}>
          {current?.label ?? placeholder ?? ''}
        </span>
        <ChevronDown
          className="h-16 w-16 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className={cn('min-w-[180px]', contentClassName)}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.value}
            onSelect={(e) => {
              e.preventDefault();
              onChange(item.value);
            }}
            className="gap-8"
          >
            <span className="flex h-16 w-16 items-center justify-center">
              {value === item.value ? (
                <Check className="h-12 w-12" aria-hidden />
              ) : null}
            </span>
            {renderItem ? renderItem(item) : <span>{item.label}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
