import { formatReunionTime } from '../../cockpit/_lib/unassigned-h1';

/**
 * Helpers de disposition PURS de la grille planning (Module 5.12 lot A) —
 * testables, sans dépendance React/Supabase. La grille découpe la journée en
 * TRANCHES HORAIRES (colonnes) ; chaque course tombe dans la tranche de son
 * heure prévue (fuseau Réunion, cohérent avec le reste du cockpit).
 */

/** Heure (0-23, fuseau Réunion) d'un horodatage ISO. -1 si invalide. */
export function reunionHour(iso: string): number {
  const hhmm = formatReunionTime(iso); // "HH:MM" ou "" si invalide
  if (hhmm === '') return -1;
  const h = parseInt(hhmm, 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : -1;
}

export interface HourRange {
  start: number;
  end: number; // inclus
}

/**
 * Amplitude horaire des colonnes : couvre AU MOINS la journée de travail type
 * (7 h → 18 h) et s'étend pour englober toute course hors de cette plage. Une
 * heure de marge après la dernière course. Entrée vide → plage par défaut.
 */
export function computeHourRange(scheduledAts: string[]): HourRange {
  const hours = scheduledAts.map(reunionHour).filter((h) => h >= 0);
  if (hours.length === 0) return { start: 7, end: 18 };
  const min = Math.min(...hours);
  const max = Math.max(...hours);
  return {
    start: Math.min(7, min),
    end: Math.min(23, Math.max(18, max + 1)),
  };
}

/** Liste des heures-colonnes (inclus les deux bornes). */
export function hourSlots(range: HourRange): number[] {
  const slots: number[] = [];
  for (let h = range.start; h <= range.end; h += 1) slots.push(h);
  return slots;
}

/** Libellé court d'une tranche horaire (« 7 h », « 14 h »). */
export function hourLabel(h: number): string {
  return `${h} h`;
}
