'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Décale une clé de jour `YYYY-MM-DD` de `delta` jours (UTC, sans dérive TZ). */
function shiftDay(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function todayReunion(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Indian/Reunion' }).format(new Date());
}

/**
 * Sélecteur de jour du planning — navigation serveur (`?date=`) : le jour choisi
 * recharge les courses côté serveur. Jour précédent / suivant, saisie directe,
 * retour à aujourd'hui.
 */
export function PlanningDayPicker({ date }: { date: string }): JSX.Element {
  const router = useRouter();
  const go = (d: string): void => {
    router.push(`/planning?date=${d}`);
  };
  const isToday = date === todayReunion();

  const dayLabel = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Indian/Reunion',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));

  return (
    <div className="flex flex-wrap items-center gap-8">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Jour précédent"
        onClick={() => go(shiftDay(date, -1))}
      >
        <ChevronLeft className="h-16 w-16" aria-hidden />
      </Button>
      <Input
        type="date"
        value={date}
        aria-label="Jour du planning"
        onChange={(e) => e.target.value && go(e.target.value)}
        className="w-[160px]"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Jour suivant"
        onClick={() => go(shiftDay(date, 1))}
      >
        <ChevronRight className="h-16 w-16" aria-hidden />
      </Button>
      {!isToday ? (
        <Button type="button" variant="outline" onClick={() => go(todayReunion())}>
          Aujourd&apos;hui
        </Button>
      ) : null}
      <span className="text-muted-foreground text-sm first-letter:uppercase">{dayLabel}</span>
    </div>
  );
}
