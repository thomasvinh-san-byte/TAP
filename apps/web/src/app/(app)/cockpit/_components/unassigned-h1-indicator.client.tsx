'use client';

import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Indicateur « courses non affectées à H-1 » (§5.13). Rouge (état d'alerte) si
 * > 0, neutre sinon. Réutilise le registre visuel destructive/neutre du cockpit.
 */
export function UnassignedH1Indicator({ count }: { count: number }): JSX.Element {
  const alert = count > 0;
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-12 rounded-md border px-12 py-12',
        alert
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/30 text-muted-foreground',
      )}
    >
      <CalendarClock className="h-16 w-16 shrink-0" aria-hidden />
      <div className="min-w-0">
        <div className="text-sm font-semibold tabular-nums">
          {count} course{count > 1 ? 's' : ''} non affectée{count > 1 ? 's' : ''}
        </div>
        <div className="text-xs">à moins d&apos;une heure du créneau</div>
      </div>
    </div>
  );
}
