'use client';

/**
 * Champ de saisie d'heure au format 24h garanti.
 *
 * L'input natif `<input type="time">` affiche AM/PM ou 24h selon la locale
 * du système de l'utilisateur — aucun attribut HTML ne permet de forcer le
 * 24h (limitation du standard, cf. MDN / WHATWG #6698). Deux `<select>` ne
 * dépendent d'aucune locale : affichage 24h identique partout.
 *
 * La valeur émise reste la chaîne `"HH:mm"` 24h — aucun impact sur les
 * calculs, la validation ou le stockage.
 */

interface TimeField24Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  minuteStep?: number;
  disabled?: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Extrait une composante numérique bornée d'une valeur `"HH:mm"`. */
function clampPart(raw: string | undefined, max: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : 0;
}

const HOURS: string[] = Array.from({ length: 24 }, (_, i) => pad2(i));

const SELECT_CLASS =
  'border-input bg-background h-32 rounded-md border px-12 text-sm ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export function TimeField24({
  id,
  value,
  onChange,
  minuteStep = 5,
  disabled,
}: TimeField24Props): JSX.Element {
  const [rawHour, rawMinute] = value.split(':');
  const hour = pad2(clampPart(rawHour, 23));
  const minute = pad2(clampPart(rawMinute, 59));

  const step = minuteStep > 0 ? minuteStep : 5;
  const minuteOptions: string[] = [];
  for (let m = 0; m < 60; m += step) minuteOptions.push(pad2(m));
  // Préserver une minute entrante hors du pas (ex. « 08:03 » avec un pas de 5).
  if (!minuteOptions.includes(minute)) {
    minuteOptions.push(minute);
    minuteOptions.sort();
  }

  return (
    <div className="flex items-center gap-8">
      <select
        id={id}
        aria-label="Heures"
        disabled={disabled}
        value={hour}
        onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        className={SELECT_CLASS}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden className="text-muted-foreground">
        :
      </span>
      <select
        aria-label="Minutes"
        disabled={disabled}
        value={minute}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        className={SELECT_CLASS}
      >
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
