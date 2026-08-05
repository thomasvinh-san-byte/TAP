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

/**
 * Décalage horaire de La Réunion : UTC+4, CONSTANT toute l'année (aucune heure
 * d'été). On l'utilise comme ancre FIXE plutôt que le fuseau du navigateur, pour
 * que l'heure murale saisie/relue corresponde toujours à l'heure réunionnaise,
 * quel que soit le fuseau du poste du régulateur (défense contre un décalage
 * silencieux si l'app est ouverte hors du fuseau 974).
 */
export const REUNION_UTC_OFFSET_HOURS = 4;
const REUNION_OFFSET_MS = REUNION_UTC_OFFSET_HOURS * 60 * 60 * 1000;
const REUNION_OFFSET_LABEL = '+04:00';

function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0');
}

/**
 * ISO 8601 → { date: Date pure jour, time: Date pure heure-minute } ou null.
 *
 * Projette l'instant vers l'heure MURALE RÉUNIONNAISE (ancre +04:00 fixe), puis
 * la reconditionne dans des Date « locales » dont les getters locaux redonnent
 * exactement cette heure murale — le fuseau ambiant s'annule à la relecture par
 * `combineDateTime` (et le sélecteur affiche l'heure réunionnaise). Accepte
 * aussi bien une valeur UTC (`Z`, données existantes) qu'une valeur à décalage
 * local (`+04:00`, nouvelles données).
 */
export function projectFromIso(iso: string | null): {
  date: Date | null;
  time: Date | null;
} {
  if (!iso) return { date: null, time: null };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const r = new Date(d.getTime() + REUNION_OFFSET_MS);
  const dateOnly = new Date(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate(), 0, 0, 0, 0);
  const timeOnly = new Date(0, 0, 0, r.getUTCHours(), r.getUTCMinutes(), 0, 0);
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

/**
 * Combine date pure + heure pure en ISO 8601 avec DÉCALAGE LOCAL RÉUNION
 * (`+04:00`), et non plus en temps universel (`Z`). Retourne null si l'un manque.
 *
 * L'heure murale saisie (lue via les getters locaux = ce qu'affiche le sélecteur)
 * est estampillée du décalage FIXE de La Réunion. La valeur produite désigne donc
 * le bon instant quel que soit le fuseau du poste, et correspond à ce que la
 * validation en aval attend (`z.string().datetime({ offset: true })` accepte le
 * décalage explicite). L'aller-retour projeter→recombiner reste stable (même
 * instant), car `projectFromIso` utilise la même ancre +04:00.
 */
export function combineDateTime(date: Date | null, time: Date | null): string | null {
  if (!date || !time) return null;
  const iso =
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(time.getHours())}:${pad(time.getMinutes())}:00${REUNION_OFFSET_LABEL}`;
  // Garde-fou : une date/heure invalide (getters → NaN) produit un ISO non
  // analysable → null (cohérent avec l'ancien Number.isNaN(combined.getTime())).
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
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
