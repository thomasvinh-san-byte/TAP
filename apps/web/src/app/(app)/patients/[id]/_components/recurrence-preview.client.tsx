'use client';

import { useMemo } from 'react';
import { generateOccurrences } from '@tap/recurrence';

const DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Indian/Reunion',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Indian/Reunion',
});

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function RecurrencePreview({
  rruleStr,
  startDate,
  holidays974,
}: {
  rruleStr: string;
  startDate: string;
  holidays974: Set<string>;
}): JSX.Element {
  const { occurrences, skipped } = useMemo(() => {
    if (!rruleStr || !startDate) {
      return { occurrences: [], skipped: [] as Date[] };
    }
    let dtstart: Date;
    try {
      dtstart = new Date(`${startDate}T08:00:00`);
      if (Number.isNaN(dtstart.getTime())) throw new Error('invalid');
    } catch {
      return { occurrences: [], skipped: [] };
    }
    const until = new Date(dtstart);
    until.setMonth(until.getMonth() + 1);

    let all: Date[];
    let kept: Date[];
    try {
      all = generateOccurrences({
        rruleStr,
        dtstart,
        until,
        holidays974: new Set(),
      });
      kept = generateOccurrences({
        rruleStr,
        dtstart,
        until,
        holidays974,
      });
    } catch {
      return { occurrences: [], skipped: [] };
    }

    const keptIso = new Set(kept.map(toIso));
    const skippedAll = all.filter((d) => !keptIso.has(toIso(d)));
    return { occurrences: kept.slice(0, 4), skipped: skippedAll.slice(0, 2) };
  }, [rruleStr, startDate, holidays974]);

  if (occurrences.length === 0 && skipped.length === 0) {
    return (
      <div className="border-border bg-muted/20 text-muted-foreground rounded-md border border-dashed p-12 text-sm">
        Renseignez les jours et la date de début pour voir les occurrences.
      </div>
    );
  }

  return (
    <div className="bg-muted/30 rounded-md border p-12">
      <h4 className="text-foreground mb-8 text-sm font-medium">
        Aperçu des 4 prochaines occurrences
      </h4>
      <ul className="space-y-2 text-sm">
        {occurrences.map((occ) => (
          <li key={`ok-${occ.toISOString()}`} className="tabular-nums">
            <span aria-hidden className="mr-8 text-emerald-700">
              ✓
            </span>
            {DAY_FORMATTER.format(occ)} à {TIME_FORMATTER.format(occ)}
          </li>
        ))}
        {skipped.map((occ) => (
          <li
            key={`skip-${occ.toISOString()}`}
            className="text-muted-foreground tabular-nums line-through"
          >
            <span aria-hidden className="mr-8">
              ⊘
            </span>
            {DAY_FORMATTER.format(occ)} — jour férié 974 (sauté)
          </li>
        ))}
      </ul>
    </div>
  );
}
