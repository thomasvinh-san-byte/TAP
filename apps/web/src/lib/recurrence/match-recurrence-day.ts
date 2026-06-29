import { generateOccurrences } from '@tap/recurrence';

/**
 * Détection PURE : une récurrence produit-elle une occurrence le jour (heure
 * locale Réunion) d'un instant donné ? (EXPRESS-02, CdG §5.8).
 *
 * Extrait de la Server Action pour être testable sans Supabase. Réutilise
 * `generateOccurrences` (expansion RRULE) — aucune réimplémentation.
 *
 * Fuseau : La Réunion = UTC+4 (pas de DST). La comparaison « même jour » se
 * fait sur la DATE LOCALE Réunion, pas sur l'ISO UTC brut (une course saisie à
 * 22 h le 12 reste le 12, pas le 13).
 */

const REUNION_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Date locale Réunion (`YYYY-MM-DD`) d'un instant. */
export function reunionDateString(d: Date): string {
  return new Date(d.getTime() + REUNION_OFFSET_MS).toISOString().slice(0, 10);
}

export interface RecurrenceDayInput {
  rruleStr: string;
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD | null (pas de fin)
  /** Dates d'exception (YYYY-MM-DD) à exclure. */
  excludedDates: Set<string>;
  /** Jours fériés 974 (YYYY-MM-DD) — une récurrence ne tombe pas un férié. */
  holidays974: Set<string>;
}

/**
 * Vrai si `rec` produit une occurrence le jour (Réunion) de `scheduledAt`,
 * dans sa plage [startDate, endDate], hors exceptions et jours fériés.
 */
export function recurrenceFallsOnDay(rec: RecurrenceDayInput, scheduledAt: Date): boolean {
  const targetDay = reunionDateString(scheduledAt);
  // Plage de validité de la récurrence (comparaison de dates ISO lexicographique).
  if (rec.startDate > targetDay) return false;
  if (rec.endDate && rec.endDate < targetDay) return false;

  // dtstart = ancre RRULE (08:00 UTC, convention occurrences du projet) ;
  // until = fin du jour cible (borne sup généreuse de l'expansion).
  const dtstart = new Date(`${rec.startDate}T08:00:00Z`);
  const until = new Date(`${targetDay}T23:59:59.999Z`);
  if (until < dtstart) return false;

  const occurrences = generateOccurrences({
    rruleStr: rec.rruleStr,
    dtstart,
    until,
    holidays974: rec.holidays974,
    excludedDates: rec.excludedDates,
  });
  return occurrences.some((d) => reunionDateString(d) === targetDay);
}
