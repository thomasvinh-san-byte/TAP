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

/**
 * Heure ET minute (fuseau Réunion) d'un horodatage ISO. `null` si invalide.
 * Sert au repère temporel « maintenant » de la grille (position fine dans la
 * colonne de l'heure courante). Réutilise `formatReunionTime` (source unique du
 * fuseau) plutôt que de recalculer un décalage.
 */
export function reunionHourMinute(iso: string): { hour: number; minute: number } | null {
  const hhmm = formatReunionTime(iso); // "HH:MM" ou ""
  if (hhmm === '') return null;
  const parts = hhmm.split(':');
  const hour = parseInt(parts[0] ?? '', 10);
  const minute = parseInt(parts[1] ?? '', 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

/**
 * Position fractionnaire du repère « maintenant » dans la suite des colonnes,
 * exprimée en unités de colonne depuis la première tranche (`0` = bord gauche de
 * la première colonne, `1` = frontière 1re/2e colonne, etc.). `null` si l'heure
 * courante est hors de la plage affichée (le repère n'est alors pas rendu). Pur
 * et testable ; la position pixel exacte est mesurée à l'affichage (largeurs de
 * colonne variables), ce helper porte la logique de plage/fraction.
 */
export function nowColumnFraction(slots: number[], hour: number, minute: number): number | null {
  const first = slots[0];
  const last = slots[slots.length - 1];
  if (first === undefined || last === undefined) return null;
  // Hors plage (avant la première tranche ou après la dernière) → pas de repère.
  if (hour < first || hour > last) return null;
  return hour - first + minute / 60;
}
