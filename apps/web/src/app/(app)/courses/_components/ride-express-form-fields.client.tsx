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
 * Sous-composants de présentation du modal saisie express. Phase 03.2.5 :
 * DateTimeFields = react-datepicker v7 (locale FR forcée, picker
 * combiné date+heure, Portal externe au Sheet pour zéro collision
 * z-index). Contient aussi pickup/dropoff, mode/urgency, notes,
 * indicateur d'auto-save. Logique métier dans le modal parent (DEC-016).
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
  const selected = value ? new Date(value) : null;
  const today = new Date();
  const minTime = setMinutes(setHours(today, SERVICE_START_HOUR), 0);
  const maxTime = setMinutes(setHours(today, SERVICE_END_HOUR), 0);

  return (
    <div className="space-y-8">
      <Label htmlFor="ride-scheduled-at">Date et heure</Label>
      <DatePicker
        id="ride-scheduled-at"
        selected={selected}
        onChange={(d: Date | null) => onChange(d ? d.toISOString() : null)}
        locale="fr"
        dateFormat="dd/MM/yyyy HH:mm"
        showTimeSelect
        timeIntervals={TIME_INTERVAL_MIN}
        timeCaption="Heure"
        minDate={today}
        minTime={minTime}
        maxTime={maxTime}
        placeholderText="jj/mm/aaaa hh:mm"
        portalId="datepicker-portal"
        popperPlacement="bottom-start"
        disabled={disabled}
        ariaInvalid={error ? 'true' : undefined}
        wrapperClassName="w-full"
        className={cn(
          'h-10 w-full min-w-0 rounded-md border border-input bg-background px-12 py-8 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:pointer-events-none disabled:opacity-50',
          'placeholder:text-muted-foreground',
          error && 'border-destructive',
        )}
      />
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
