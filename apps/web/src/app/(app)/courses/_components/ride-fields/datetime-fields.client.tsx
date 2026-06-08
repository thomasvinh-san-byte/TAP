'use client';

import { useEffect, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import { setHours, setMinutes } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { Label } from '@/components/ui/label';
import {
  SERVICE_END_HOUR,
  SERVICE_START_HOUR,
  TIME_INTERVAL_MIN,
  combineDateTime,
  projectFromIso,
  sameDate,
  sameTime,
} from './datetime-helpers';
import { DateMaskedInput, TimeMaskedInput } from './masked-inputs.client';

/**
 * DateTimeFields — deux champs distincts (date à gauche, heure à droite,
 * grid-cols-2 gap-12). Extrait de `ride-express-form-fields.client.tsx`
 * (Phase 06.27 lot 4).
 *
 * react-datepicker v7 avec :
 *   - customInput maison à masque (auto-insertion des séparateurs / et :)
 *   - icône Calendar/Clock à gauche (wrapper relative + absolute, pointer-
 *     events-none, pl-32) ; clic-bloc gère l'ouverture du popper
 *   - strictParsing + isClearable (croix de reset, pr-32)
 *   - inputMode=numeric, maxLength 10/5, enterKeyHint next/done,
 *     autoComplete=off — confort saisie clavier régulateur et mobile
 *   - locale fr forcée, dateFormat dd/MM/yyyy + HH:mm, calendarStartDay=1
 *     (lundi), todayButton "Aujourd'hui", aria-labels mois précédent/suivant
 *   - minDate=today, minTime/maxTime 05:00-22:00, timeIntervals=15
 *   - filterTime dynamique : exclut les créneaux passés si la date sélec-
 *     tionnée est aujourd'hui
 *   - fixedHeight (pas de saut entre mois 5/6 lignes), showPopperArrow=false
 *   - rendu inline (PAS de portail externe) : Radix Dialog inert ses
 *     siblings dans <body>, donc un <div id="datepicker-portal"> placé
 *     en sibling devient inert quand le Dialog est ouvert (Phase 03.2.8).
 *     Le popper reste dans le DialogContent ; z-index 80 (globals.css)
 *     suffit à le placer au-dessus du DialogContent (z-50).
 *
 * Combinaison interne via états locaux pour préserver la saisie partielle ;
 * le parent voit toujours un ISO 8601 complet ou null si l'un des deux est
 * manquant. Sync externe via useEffect + comparaison projection-locale pour
 * éviter la boucle de reset (prefill async, reset modal, édition existante).
 * onBlur propagé depuis le modal parent pour autosave.
 */

registerLocale('fr', fr);

export function DateTimeFields({
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  /** ISO 8601 UTC ou null. */
  value: string | null;
  onChange: (iso: string | null) => void;
  /** Notification du modal parent pour autosave (DEC-016). */
  onBlur?: () => void;
  error?: string | null;
  disabled?: boolean;
}): JSX.Element {
  const [localDate, setLocalDate] = useState<Date | null>(() => projectFromIso(value).date);
  const [localTime, setLocalTime] = useState<Date | null>(() => projectFromIso(value).time);

  // Sync externe : si `value` change (prefill async, reset modal, édition
  // existante), reprojeter en local SEULEMENT si la valeur externe ne
  // correspond plus à la combinaison locale. Évite la boucle reset →
  // émit → reset où le parent renverrait la valeur émise.
  useEffect(() => {
    const projected = projectFromIso(value);
    if (!sameDate(localDate, projected.date) || !sameTime(localTime, projected.time)) {
      setLocalDate(projected.date);
      setLocalTime(projected.time);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const today = new Date();
  const minTime = setMinutes(setHours(today, SERVICE_START_HOUR), 0);
  const maxTime = setMinutes(setHours(today, SERVICE_END_HOUR), 0);

  const handleDate = (d: Date | null): void => {
    setLocalDate(d);
    onChange(combineDateTime(d, localTime));
  };
  const handleTime = (t: Date | null): void => {
    setLocalTime(t);
    onChange(combineDateTime(localDate, t));
  };

  // filterTime dynamique : si la date sélectionnée est aujourd'hui, exclure
  // les créneaux antérieurs à l'heure courante. Sinon, tous OK (la borne
  // service 05:00-22:00 est portée par minTime/maxTime).
  const filterTime = (time: Date): boolean => {
    if (!localDate) return true;
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const localMid = new Date(localDate);
    localMid.setHours(0, 0, 0, 0);
    if (localMid.getTime() !== todayMid.getTime()) return true;
    const now = new Date();
    const candidate = new Date(now);
    candidate.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return candidate.getTime() > now.getTime();
  };

  const ariaInvalidFlag: 'true' | undefined = error ? 'true' : undefined;

  return (
    <div className="space-y-8">
      <Label htmlFor="ride-scheduled-date">Date et heure</Label>
      <div className="grid grid-cols-2 gap-12">
        <DatePicker
          id="ride-scheduled-date"
          selected={localDate}
          onChange={handleDate}
          onBlur={onBlur}
          locale="fr"
          dateFormat="dd/MM/yyyy"
          minDate={today}
          strictParsing
          isClearable
          placeholderText="jj/mm/aaaa"
          popperPlacement="bottom-start"
          showPopperArrow={false}
          fixedHeight
          calendarStartDay={1}
          todayButton="Aujourd'hui"
          previousMonthAriaLabel="Mois précédent"
          nextMonthAriaLabel="Mois suivant"
          disabled={disabled}
          ariaInvalid={ariaInvalidFlag}
          wrapperClassName="w-full min-w-0"
          customInput={<DateMaskedInput />}
        />
        <DatePicker
          id="ride-scheduled-time"
          selected={localTime}
          onChange={handleTime}
          onBlur={onBlur}
          locale="fr"
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={TIME_INTERVAL_MIN}
          timeCaption="Heure"
          minTime={minTime}
          maxTime={maxTime}
          filterTime={filterTime}
          dateFormat="HH:mm"
          timeFormat="HH:mm"
          strictParsing
          isClearable
          placeholderText="hh:mm"
          popperPlacement="bottom-start"
          showPopperArrow={false}
          disabled={disabled}
          ariaInvalid={ariaInvalidFlag}
          wrapperClassName="w-full min-w-0"
          customInput={<TimeMaskedInput />}
        />
      </div>
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
