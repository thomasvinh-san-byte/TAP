/**
 * Helpers purs date/heure pour la saisie express d'une course.
 * Module sans dépendance React — testable, ré-utilisable.
 * Extrait de `ride-express-form-fields.client.tsx` (Phase 06.27 lot 4).
 */

/**
 * Plage horaire de service taxi conventionné TAP Réunion : 05h00 → 22h00.
 * Couvre dialyse matinale (premières séances 5h-6h) et sorties hôpital
 * tardives. react-datepicker filtre la colonne d'heures via min/max.
 */
export const SERVICE_START_HOUR = 5;
export const SERVICE_END_HOUR = 22;
export const TIME_INTERVAL_MIN = 15;

/** ISO 8601 → { date: Date pure jour, time: Date pure heure-minute } ou null. */
export function projectFromIso(iso: string | null): {
  date: Date | null;
  time: Date | null;
} {
  if (!iso) return { date: null, time: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const timeOnly = new Date(0, 0, 0, d.getHours(), d.getMinutes(), 0, 0);
  return { date: dateOnly, time: timeOnly };
}

export function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function sameTime(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
}

/** Combine date pure + heure pure en ISO 8601 UTC. Retourne null si l'un manque. */
export function combineDateTime(date: Date | null, time: Date | null): string | null {
  if (!date || !time) return null;
  const combined = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0,
  );
  return Number.isNaN(combined.getTime()) ? null : combined.toISOString();
}

export function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/** "13052026" → "13/05/2026". Tronque à 8 chiffres. */
export function formatDateMask(digits: string): string {
  const d = digits.slice(0, 8);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "1430" → "14:30". Tronque à 4 chiffres. */
export function formatTimeMask(digits: string): string {
  const d = digits.slice(0, 4);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}
