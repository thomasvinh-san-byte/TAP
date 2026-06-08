'use client';

import Link, { type LinkProps } from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * <SegmentedControl> + <SegmentedNav> — toggle multi-segments sobre
 * façon Linear / iOS (Phase 06.31, DEC-110bis).
 *
 * Remplace l'ancien pattern « bouton enfoncé » dupliqué (patients,
 * chauffeurs, assign-modal) au profil daté : conteneur `p-2` trop serré,
 * pastille active différenciée par une OMBRE seule, pas de poids typo,
 * pas de transition.
 *
 * Cible (direction DEC-101 §5 / §5bis) :
 *   - Conteneur : fond `bg-muted` sobre, `rounded-lg`, padding `p-4`
 *     confortable, `gap-4` entre segments.
 *   - Actif : `bg-background` + `text-foreground` + `font-medium`
 *     + ombre token `shadow-sm` + `rounded-md`. La pastille gagne par
 *     contraste de fond + poids typo, l'ombre n'est qu'un soutien
 *     léger.
 *   - Inactif : `text-muted-foreground`, hover `text-foreground`
 *     + `bg-background/50`.
 *   - Transition 150ms ease-out (grammaire animation §5), `prefers-
 *     reduced-motion` couvert par règle globale `globals.css`.
 *   - Focus ring `focus-visible:ring-ring` (RGAA).
 *   - Cibles tactiles : `py-6 px-12` minimum.
 *
 * Deux variantes :
 *   - `<SegmentedControl>` : segments = `<button>` ; usage state local
 *     (patients-list, assign-modal).
 *   - `<SegmentedNav>` : segments = `<Link>` ; usage navigation URL
 *     (chauffeurs ?vue=actifs|archives).
 *
 * Accessibilité préservée : `role="tablist"` sur le conteneur,
 * `role="tab"` + `aria-selected` sur chaque segment.
 */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
}

const containerCls = 'inline-flex items-center gap-4 rounded-lg bg-muted p-4';

const segmentBaseCls =
  'rounded-md px-12 py-6 text-sm transition-all duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted';

const segmentActiveCls = 'bg-background text-foreground font-medium shadow-sm';
const segmentInactiveCls = 'text-muted-foreground hover:bg-background/50 hover:text-foreground';

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onValueChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>): JSX.Element {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(containerCls, className)}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(opt.value)}
            className={cn(segmentBaseCls, isActive ? segmentActiveCls : segmentInactiveCls)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export interface SegmentedNavOption<T extends string> extends SegmentOption<T> {
  href: LinkProps['href'];
}

interface SegmentedNavProps<T extends string> {
  options: SegmentedNavOption<T>[];
  value: T;
  ariaLabel: string;
  className?: string;
}

export function SegmentedNav<T extends string>({
  options,
  value,
  ariaLabel,
  className,
}: SegmentedNavProps<T>): JSX.Element {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn(containerCls, className)}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <Link
            key={opt.value}
            href={opt.href}
            role="tab"
            aria-selected={isActive}
            className={cn(segmentBaseCls, isActive ? segmentActiveCls : segmentInactiveCls)}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
