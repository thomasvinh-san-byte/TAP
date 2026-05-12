'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * Sous-composants de présentation du modal saisie express (Phase 2 / Wave 3,
 * date+time picker natif Phase 03.1.1). Extrait pour respecter la limite
 * 300 lignes/fichier (CLAUDE.md § 11).
 *
 * Contient les champs date+time natifs, pickup/dropoff, mode/urgency,
 * notes, et l'indicateur d'auto-save. La logique métier (validation,
 * persistence) reste dans le modal parent (DEC-016 : pas de logique
 * métier en composant).
 */

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

function todayIso(): string {
  // ISO local YYYY-MM-DD pour l'attribut min de l'input date.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function splitIso(iso: string | null): { date: string; time: string } {
  // ISO 8601 UTC → date+time locaux pour les inputs natifs.
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: `${y}-${mo}-${da}`, time: `${hh}:${mm}` };
}

function combineToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const combined = new Date(`${date}T${time}:00`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined.toISOString();
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
  const { date, time } = splitIso(value);
  const min = todayIso();

  const handleDateChange = (next: string): void => {
    onChange(combineToIso(next, time));
  };
  const handleTimeChange = (next: string): void => {
    onChange(combineToIso(date, next));
  };

  return (
    <div className="space-y-8">
      <Label htmlFor="ride-date">Date et heure</Label>
      <div className="grid grid-cols-2 gap-12">
        <Input
          id="ride-date"
          type="date"
          aria-label="Date"
          value={date}
          min={min}
          onChange={(e) => handleDateChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(error && 'border-destructive focus-visible:ring-destructive')}
          disabled={disabled}
          tabIndex={2}
        />
        <Input
          id="ride-time"
          type="time"
          aria-label="Heure"
          value={time}
          step={300}
          onChange={(e) => handleTimeChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={cn(error && 'border-destructive focus-visible:ring-destructive')}
          disabled={disabled}
          tabIndex={3}
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
