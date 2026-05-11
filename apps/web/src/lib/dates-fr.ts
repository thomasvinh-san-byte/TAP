/**
 * Formatters dates/heures FR — relatifs ou courts.
 *
 * Pas de date-fns (dépendance évitée V1). Le glossaire reste minimal :
 * "à l'instant", "il y a N min/h/j", "dans N min/h/j", JJ/MM, HHhMM.
 *
 * Toutes les fonctions sont pures et sûres côté serveur comme client
 * (pas d'I18n locale, formats explicites).
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "à l'instant", "il y a 12 min", "il y a 3 h", "il y a 2 j".
 * Pour les futurs : "dans 12 min", "dans 3 h", "dans 2 j".
 */
export function formatRelativeFr(iso: string, now = Date.now()): string {
  const target = new Date(iso).getTime();
  const diffMs = target - now;
  const abs = Math.abs(diffMs);
  const future = diffMs > 0;

  if (abs < 45 * SECOND) return "à l'instant";

  const pick = (
    n: number,
    unit: 'min' | 'h' | 'j',
  ): string => (future ? `dans ${n} ${unit}` : `il y a ${n} ${unit}`);

  if (abs < HOUR) return pick(Math.round(abs / MINUTE), 'min');
  if (abs < DAY) return pick(Math.round(abs / HOUR), 'h');
  return pick(Math.round(abs / DAY), 'j');
}

/** "JJ/MM" (zero-pad). */
export function formatShortDateFr(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** "HHhMM" (zero-pad), notation FR avec h séparateur. */
export function formatTimeFr(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}h${mm}`;
}

/** True si l'ISO tombe sur la date locale d'aujourd'hui. */
export function isToday(iso: string, now = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** "Aujourd'hui à HHhMM" ou "JJ/MM à HHhMM" selon proximité. */
export function formatDateTimeFr(iso: string): string {
  if (isToday(iso)) return `Aujourd'hui à ${formatTimeFr(iso)}`;
  return `${formatShortDateFr(iso)} à ${formatTimeFr(iso)}`;
}

/** Différence en jours calendaires (ignore l'heure), négatif si passé. */
export function daysFromNow(iso: string, now = new Date()): number {
  const a = new Date(iso);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / DAY);
}
