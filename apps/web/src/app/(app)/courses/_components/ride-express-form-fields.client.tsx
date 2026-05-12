'use client';

import { useEffect, useState } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import { fr } from 'date-fns/locale';
import { setHours, setMinutes } from 'date-fns';
import 'react-datepicker/dist/react-datepicker.css';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * Sous-composants de présentation du modal saisie express. Phase 03.2.7 :
 * DateTimeFields = deux champs distincts (date à gauche, heure à droite,
 * grid-cols-2 gap-12), chacun un react-datepicker v7. Combinaison interne
 * via états locaux pour préserver la saisie partielle ; le parent voit
 * toujours un ISO 8601 complet ou null si l'un des deux est manquant.
 * Sync externe via useEffect avec comparaison projection-locale pour
 * éviter la boucle de reset (prefill async, reset modal). Portal externe
 * (#datepicker-portal dans layout.tsx) commun aux deux pickers, zéro
 * collision z-index avec le Sheet Radix. Contient aussi pickup/dropoff,
 * mode/urgency, notes, indicateur d'auto-save. Logique métier dans le
 * modal parent (DEC-016).
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
  const dateOnly = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    0, 0, 0, 0,
  );
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
    0, 0,
  );
  return Number.isNaN(combined.getTime()) ? null : combined.toISOString();
}

export function DateTimeFields({
  value,
  onChange,
  error,
  disabled,
}: {
  /** ISO 8601 UTC ou null. */
  value: string | null;
  onChange: (iso: string | null) => void;
  error?: string | null;
  disabled?: boolean;
}): JSX.Element {
  const [localDate, setLocalDate] = useState<Date | null>(
    () => projectFromIso(value).date,
  );
  const [localTime, setLocalTime] = useState<Date | null>(
    () => projectFromIso(value).time,
  );

  // Sync externe : si `value` change (prefill async, reset modal, édition
  // existante), reprojeter en local SEULEMENT si la valeur externe ne
  // correspond plus à la combinaison locale. Évite la boucle reset →
  // émit → reset où le parent renverrait la valeur émise.
  useEffect(() => {
    const projected = projectFromIso(value);
    if (
      !sameDate(localDate, projected.date) ||
      !sameTime(localTime, projected.time)
    ) {
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

  const fieldClass = cn(
    'h-10 w-full min-w-0 rounded-md border border-input bg-background px-12 py-8 text-sm',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    'placeholder:text-muted-foreground',
    error && 'border-destructive',
  );

  return (
    <div className="space-y-8">
      <Label htmlFor="ride-scheduled-date">Date et heure</Label>
      <div className="grid grid-cols-2 gap-12">
        <DatePicker
          id="ride-scheduled-date"
          selected={localDate}
          onChange={handleDate}
          locale="fr"
          dateFormat="dd/MM/yyyy"
          minDate={today}
          placeholderText="jj/mm/aaaa"
          portalId="datepicker-portal"
          popperPlacement="bottom-start"
          disabled={disabled}
          ariaInvalid={error ? 'true' : undefined}
          wrapperClassName="w-full"
          className={fieldClass}
        />
        <DatePicker
          id="ride-scheduled-time"
          selected={localTime}
          onChange={handleTime}
          locale="fr"
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={TIME_INTERVAL_MIN}
          timeCaption="Heure"
          minTime={minTime}
          maxTime={maxTime}
          dateFormat="HH:mm"
          timeFormat="HH:mm"
          placeholderText="hh:mm"
          portalId="datepicker-portal"
          popperPlacement="bottom-start"
          disabled={disabled}
          ariaInvalid={error ? 'true' : undefined}
          wrapperClassName="w-full"
          className={fieldClass}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
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
        <p className="text-xs text-destructive" role="alert">
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
        Erreur de sauvegarde — réessai dans 5 s
      </span>
    );
  }
  if (state === 'saved' && lastSavedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - lastSavedAt) / 1000));
    return <span aria-live="polite">Sauvegardé il y a {seconds} s</span>;
  }
  return <span>&nbsp;</span>;
}
