'use client';

import { type ChangeEvent, forwardRef, useEffect, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import { setHours, setMinutes } from 'date-fns';
import { Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * Sous-composants de présentation du modal saisie express. Phase 03.2.6
 * (DateTimeFields finalisé) : deux champs distincts (date à gauche, heure
 * à droite, grid-cols-2 gap-12), chacun un react-datepicker v7 avec :
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
 * Combinaison interne via états locaux pour préserver la saisie partielle ;
 * le parent voit toujours un ISO 8601 complet ou null si l'un des deux est
 * manquant. Sync externe via useEffect + comparaison projection-locale pour
 * éviter la boucle de reset (prefill async, reset modal, édition existante).
 * onBlur propagé depuis le modal parent pour autosave.
 * Contient aussi pickup/dropoff, mode/urgency, notes, indicateur d'auto-save.
 * Logique métier dans le modal parent (DEC-016).
 */

registerLocale('fr', fr);

export type TransportMode = 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';
export type Urgency = 'programmee' | 'urgente' | 'immediate';

const TRANSPORT_OPTIONS: ReadonlyArray<{ value: TransportMode; label: string }> = [
  { value: 'taxi_conventionne', label: 'Taxi conventionné' },
  { value: 'tpmr', label: 'TPMR (fauteuil)' },
  { value: 'vsl', label: 'VSL' },
  { value: 'ambulance', label: 'Ambulance' },
];

const URGENCY_OPTIONS: ReadonlyArray<{ value: Urgency; label: string }> = [
  { value: 'programmee', label: 'Programmée' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'immediate', label: 'Immédiate' },
];

/**
 * Plage horaire de service taxi conventionné TAP Réunion : 05h00 → 22h00.
 * Couvre dialyse matinale (premières séances 5h-6h) et sorties hôpital
 * tardives. react-datepicker filtre la colonne d'heures via min/max.
 */
const SERVICE_START_HOUR = 5;
const SERVICE_END_HOUR = 22;
const TIME_INTERVAL_MIN = 15;

/** ISO 8601 → { date: Date pure jour, time: Date pure heure-minute } ou null. */
function projectFromIso(iso: string | null): {
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

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sameTime(a: Date | null, b: Date | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.getHours() === b.getHours() && a.getMinutes() === b.getMinutes();
}

/** Combine date pure + heure pure en ISO 8601 UTC. Retourne null si l'un manque. */
function combineDateTime(date: Date | null, time: Date | null): string | null {
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

// ---------------------------------------------------------------------------
// Masques d'auto-insertion des séparateurs (clavier régulateur + mobile)
// ---------------------------------------------------------------------------

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/** "13052026" → "13/05/2026". Tronque à 8 chiffres. */
function formatDateMask(digits: string): string {
  const d = digits.slice(0, 8);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "1430" → "14:30". Tronque à 4 chiffres. */
function formatTimeMask(digits: string): string {
  const d = digits.slice(0, 4);
  if (d.length === 0) return '';
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

interface MaskedFieldProps {
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onClick?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: boolean | 'true' | 'false';
}

const MASKED_FIELD_CLASS = cn(
  'h-10 w-full min-w-0 rounded-md border border-input bg-background pl-32 pr-32 py-8 text-sm',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  'disabled:pointer-events-none disabled:opacity-50',
  'placeholder:text-muted-foreground',
  'aria-[invalid=true]:border-destructive',
);

const DateMaskedInput = forwardRef<HTMLInputElement, MaskedFieldProps>(function DateMaskedInput(
  { value = '', onChange, onClick, onBlur, onFocus, placeholder, disabled, ariaInvalid },
  ref,
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    e.target.value = formatDateMask(digitsOnly(e.target.value));
    onChange?.(e);
  };
  return (
    <div className="relative w-full">
      <CalendarIcon
        className="text-muted-foreground pointer-events-none absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        maxLength={10}
        enterKeyHint="next"
        autoComplete="off"
        aria-label="Date"
        aria-invalid={ariaInvalid === 'true' || ariaInvalid === true || undefined}
        value={value}
        onChange={handleChange}
        onClick={onClick}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={MASKED_FIELD_CLASS}
      />
    </div>
  );
});

const TimeMaskedInput = forwardRef<HTMLInputElement, MaskedFieldProps>(function TimeMaskedInput(
  { value = '', onChange, onClick, onBlur, onFocus, placeholder, disabled, ariaInvalid },
  ref,
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    e.target.value = formatTimeMask(digitsOnly(e.target.value));
    onChange?.(e);
  };
  return (
    <div className="relative w-full">
      <ClockIcon
        className="text-muted-foreground pointer-events-none absolute left-12 top-1/2 h-16 w-16 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        maxLength={5}
        enterKeyHint="done"
        autoComplete="off"
        aria-label="Heure"
        aria-invalid={ariaInvalid === 'true' || ariaInvalid === true || undefined}
        value={value}
        onChange={handleChange}
        onClick={onClick}
        onBlur={onBlur}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        className={MASKED_FIELD_CLASS}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// DateTimeFields
// ---------------------------------------------------------------------------

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
          wrapperClassName="w-full"
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
          wrapperClassName="w-full"
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

export function AddressField({
  id,
  label,
  ariaLabel,
  value,
  onChange,
  onBlur,
  tabIndex,
  error,
}: {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  tabIndex: number;
  error?: string | null;
}): JSX.Element {
  return (
    <div className="space-y-8">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete="off"
        tabIndex={tabIndex}
        required
      />
      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ModeUrgencyFields({
  mode,
  urgency,
  onModeChange,
  onUrgencyChange,
}: {
  mode: TransportMode;
  urgency: Urgency;
  onModeChange: (m: TransportMode) => void;
  onUrgencyChange: (u: Urgency) => void;
}): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-16">
      <div className="space-y-8">
        <Label htmlFor="mode">Mode de transport</Label>
        <Select
          ariaLabel="Mode de transport"
          value={mode}
          onChange={(v) => onModeChange(v as TransportMode)}
          items={[...TRANSPORT_OPTIONS]}
          triggerClassName="w-full"
        />
      </div>
      <div className="space-y-8">
        <Label htmlFor="urgency">Urgence</Label>
        <Select
          ariaLabel="Urgence"
          value={urgency}
          onChange={(v) => onUrgencyChange(v as Urgency)}
          items={[...URGENCY_OPTIONS]}
          triggerClassName="w-full"
        />
      </div>
    </div>
  );
}

export function NotesField({
  value,
  onChange,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}): JSX.Element {
  return (
    <div className="space-y-8">
      <Label htmlFor="notes">Notes (optionnel)</Label>
      <Textarea
        id="notes"
        aria-label="Notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={500}
        rows={2}
        tabIndex={7}
        className="min-h-0 resize-none"
      />
    </div>
  );
}

export function SavingIndicator({
  state,
  lastSavedAt,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
}): JSX.Element {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  if (state === 'saving') return <span aria-live="polite">Sauvegarde…</span>;
  if (state === 'error') {
    return (
      <span className="text-destructive" role="alert">
        Erreur de sauvegarde : réessai dans 5 s
      </span>
    );
  }
  if (state === 'saved' && lastSavedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000));
    return <span aria-live="polite">Sauvegardé il y a {seconds} s</span>;
  }
  return <span>&nbsp;</span>;
}
