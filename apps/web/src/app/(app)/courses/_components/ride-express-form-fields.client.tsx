'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/**
 * Sous-composants de présentation du modal saisie express. Phase 03.2.4 :
 * DateTimeFields = inputs HTML natifs (HTML5 depuis 2014, zéro dépendance,
 * zéro Portal, zéro z-index). Contient aussi pickup/dropoff, mode/urgency,
 * notes, indicateur d'auto-save. Logique métier dans le modal parent (DEC-016).
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

/**
 * Créneaux 15 min restreints aux heures de service taxi conventionné TAP
 * Réunion : 5h00 → 22h00 inclus (D-DTPICK-27 Phase 03.2.1).
 *
 * Couvre :
 * - Dialyse matinale (premières séances 5h-6h)
 * - Consultations en journée
 * - Sorties hôpital tardives (jusqu'à 22h)
 *
 * Pattern Doctolib / Cal.com — 24H par construction. Hors plage =
 * cas particulier (urgence ou override manuel ultérieur).
 *
 * 69 créneaux : 05:00, 05:15, ..., 21:45, 22:00.
 */
const TIME_SLOT_START_HOUR = 5;
const TIME_SLOT_END_HOUR = 22; // inclus
const TIME_SLOT_STEP_MIN = 15;
const TIME_SLOTS: ReadonlyArray<{ value: string; label: string }> = Array.from(
  {
    length:
      ((TIME_SLOT_END_HOUR - TIME_SLOT_START_HOUR) * 60) / TIME_SLOT_STEP_MIN +
      1,
  },
  (_, i) => {
    const totalMinutes = TIME_SLOT_START_HOUR * 60 + i * TIME_SLOT_STEP_MIN;
    const h = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
    const m = String(totalMinutes % 60).padStart(2, '0');
    const v = `${h}:${m}`;
    return { value: v, label: v };
  },
);

/** Combine une date 'yyyy-mm-dd' + un créneau 'HH:MM' en ISO 8601 UTC. */
function combineToIso(dateStr: string, time: string): string | null {
  if (!dateStr || !time) return null;
  const dateParts = dateStr.split('-');
  const timeParts = time.split(':');
  if (dateParts.length !== 3 || timeParts.length !== 2) return null;
  const y = Number(dateParts[0]);
  const mo = Number(dateParts[1]);
  const d = Number(dateParts[2]);
  const h = Number(timeParts[0]);
  const mi = Number(timeParts[1]);
  if ([y, mo, d, h, mi].some(Number.isNaN)) return null;
  const out = new Date(y, mo - 1, d, h, mi, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** ISO 8601 → { dateStr: 'yyyy-mm-dd', time: 'HH:MM' } pour les inputs natifs. */
function splitIso(iso: string | null): {
  dateStr: string;
  time: string;
} {
  if (!iso) return { dateStr: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { dateStr: '', time: '' };
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { dateStr: `${yyyy}-${mo}-${dd}`, time: `${hh}:${mm}` };
}

/** 'yyyy-mm-dd' du jour pour `min` attribute (refus passé côté navigateur). */
function todayIsoDate(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd}`;
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
  const { dateStr, time } = splitIso(value);

  const handleDateChange = (next: string): void => {
    onChange(combineToIso(next, time));
  };
  const handleTimeChange = (next: string): void => {
    onChange(combineToIso(dateStr, next));
  };

  return (
    <div className="space-y-8">
      <Label>Date et heure</Label>
      {/* Phase 03.2.4 — inputs HTML natifs (HTML5 depuis 2014).
          Pattern éprouvé : type=date → calendrier OS natif au clic ;
          select natif → menu déroulant OS. Aucune dépendance, aucun
          Portal, aucun z-index, fonctionne identique partout. */}
      <div className="grid grid-cols-2 gap-12">
        <Input
          type="date"
          aria-label="Date"
          value={dateStr}
          min={todayIsoDate()}
          onChange={(e) => handleDateChange(e.target.value)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={cn('min-w-0', error && 'border-destructive')}
          tabIndex={2}
        />
        <select
          aria-label="Heure"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={cn(
            'flex h-40 w-full min-w-0 items-center rounded-md border border-input bg-background px-12 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'disabled:pointer-events-none disabled:opacity-50',
            error && 'border-destructive',
            !time && 'text-muted-foreground',
          )}
          tabIndex={3}
        >
          <option value="" disabled>
            hh:mm
          </option>
          {TIME_SLOTS.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
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
