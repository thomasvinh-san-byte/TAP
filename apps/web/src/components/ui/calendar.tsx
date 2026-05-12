'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';

// CSS de base react-day-picker v9 (grid, sizing, layout interne).
// Sans cet import, le calendrier rend sans aucun layout (chiffres empilés).
// Cf. github.com/gpbl/react-day-picker discussion #2280 + #2208.
import 'react-day-picker/style.css';

import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Composant Calendar shadcn — react-day-picker v9 (D-DTPICK-20ter
 * Phase 03.2.2 hotfix).
 *
 * Approche : on garde le CSS de base v9 (`react-day-picker/style.css`)
 * pour le layout grid / sizing des cellules / position des chevrons, et
 * on ajoute uniquement quelques overrides Tailwind cohérents avec le
 * thème shadcn (couleur primary pour selected, accent pour today,
 * muted-foreground pour outside/disabled).
 *
 * Locale FR injectée par défaut (NFR-001) ; override possible via prop.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  locale = fr,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn('p-12', className)}
      classNames={{
        // Overrides shadcn : couleurs uniquement (le layout vient du CSS v9).
        selected:
          'rdp-selected !bg-primary !text-primary-foreground hover:!bg-primary',
        today: 'rdp-today !text-accent-foreground font-semibold',
        outside: 'rdp-outside !text-muted-foreground !opacity-50',
        disabled: 'rdp-disabled !text-muted-foreground !opacity-30',
        caption_label: 'text-sm font-medium capitalize',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...iconProps }) =>
          orientation === 'left' ? (
            <ChevronLeft
              className={cn('h-16 w-16', chevronClassName)}
              aria-hidden
              {...iconProps}
            />
          ) : (
            <ChevronRight
              className={cn('h-16 w-16', chevronClassName)}
              aria-hidden
              {...iconProps}
            />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
