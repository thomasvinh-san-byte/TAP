'use client';

import { useEffect, useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { startOfDay } from 'date-fns';
import { formatDateFr } from '@tap/shared';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

/**
 * Sous-composants de présentation du modal saisie express (Phase 2 / Wave 3 ;
 * Phase 03.1.1 : DatePicker shadcn officiel + Select 96 créneaux 15 min).
 * Extrait pour respecter la limite 300 lignes/fichier (CLAUDE.md § 11).
 *
 * Contient DateTimeFields (D-DTPICK-19..25 : Popover+Calendar+Select),
 * pickup/dropoff, mode/urgency, notes, indicateur d'auto-save. La logique
 * métier (validation, persistence) reste dans le modal parent (DEC-016).
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

/** Combine une Date (jour) + un créneau hh:mm en ISO 8601 UTC. */
function combineToIso(date: Date | undefined, time: string): string | null {
  if (!date || !time) return null;
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const out = new Date(date);
  out.setHours(h, m, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out.toISOString();
}

/** ISO 8601 → { day: Date, time: 'hh:mm' } pour l'état UI. */
function splitIso(iso: string | null): {
  day: Date | undefined;
  time: string;
} {
  if (!iso) return { day: undefined, time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: undefined, time: '' };
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { day: d, time: `${hh}:${mm}` };
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
  const { day, time } = splitIso(value);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleDayChange = (next: Date | undefined): void => {
    onChange(combineToIso(next, time));
    setPopoverOpen(false);
  };
  const handleTimeChange = (next: string): void => {
    onChange(combineToIso(day, next));
  };

  return (
    <div className="space-y-8">
      <Label>Date et heure</Label>
      {/* D-DTPICK-9 (conservé) : min-w-0 sur les 2 colonnes — Calendar Popover
          a une largeur intrinsèque qui peut casser le grid sur mobile 375px. */}
      <div className="grid grid-cols-2 gap-12">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              className={cn(
                'min-w-0 justify-start text-left font-normal',
                !day && 'text-muted-foreground',
                error && 'border-destructive',
              )}
              tabIndex={2}
            >
              <CalendarIcon className="mr-8 h-16 w-16" aria-hidden />
              {day ? formatDateFr(day) : 'jj/mm/aaaa'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={day}
              onSelect={handleDayChange}
              disabled={(d) => d < startOfDay(new Date())}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        <Select
          ariaLabel="Heure"
          value={time}
          onChange={handleTimeChange}
          items={[...TIME_SLOTS]}
          triggerClassName="min-w-0 w-full"
          contentClassName="max-h-[260px] overflow-y-auto"
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
