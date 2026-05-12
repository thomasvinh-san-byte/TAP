'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { fr } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Composant Calendar shadcn — migration react-day-picker v9 (D-DTPICK-26
 * Phase 03.2.1 hotfix).
 *
 * Le template shadcn officiel cible toujours react-day-picker v8 ; v9 a
 * renommé toutes les clés de `classNames` (month_caption au lieu de caption,
 * weekdays / weekday au lieu de head_row / head_cell, button_previous /
 * button_next au lieu de nav_button_*, etc.). Le calendrier rendait
 * illisible (chiffres empilés, jours collés) tant que les anciens noms v8
 * étaient utilisés.
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
        months: 'flex flex-col sm:flex-row gap-16',
        month: 'flex flex-col gap-16',
        month_caption: 'flex justify-center items-center h-32 relative',
        caption_label: 'text-sm font-medium',
        nav: 'flex items-center justify-between absolute inset-x-0 top-0 h-32 px-2',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-28 w-28 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-28 w-28 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'text-muted-foreground rounded-md w-36 font-normal text-xs text-center',
        week: 'flex w-full mt-8',
        day: 'h-36 w-36 text-center text-sm p-0 relative',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-36 w-36 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        range_middle:
          'aria-selected:bg-accent aria-selected:text-accent-foreground',
        hidden: 'invisible',
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
