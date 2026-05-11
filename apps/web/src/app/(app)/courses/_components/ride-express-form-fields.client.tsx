'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { parseFreeformDate } from '@tap/shared';

/**
 * Sous-composants de présentation du modal saisie express (Phase 2 / Wave 3).
 * Extrait pour respecter la limite 300 lignes/fichier (CLAUDE.md § 11).
 *
 * Contient les champs date freeform, pickup/dropoff, mode/urgency, notes,
 * et l'indicateur d'auto-save. La logique métier (validation, persistence)
 * reste dans le modal parent (DEC-016 : pas de logique métier en composant).
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

export function DateFreeformField({
  value,
  onChange,
  onParsed,
  error,
  onError,
}: {
  value: string;
  onChange: (v: string) => void;
  onParsed: (iso: string) => void;
  error: string | null;
  onError: (e: string | null) => void;
}): JSX.Element {
  return (
    <div className="space-y-8">
      <Label htmlFor="date">Date et heure</Label>
      <Input
        id="date"
        aria-label="Date et heure"
        placeholder="ex : 15/05 14h30 — demain 8h — lundi 9h"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value) return;
          const parsed = parseFreeformDate(value);
          if (parsed.ok) {
            onError(null);
            onParsed(parsed.iso);
          } else {
            onError(parsed.reason);
          }
        }}
        autoComplete="off"
        tabIndex={2}
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
          id="mode"
          ariaLabel="Mode de transport"
          value={mode}
          onChange={(v) => onModeChange(v as TransportMode)}
          items={[...TRANSPORT_OPTIONS]}
          tabIndex={5}
          triggerClassName="w-full"
        />
      </div>
      <div className="space-y-8">
        <Label htmlFor="urgency">Urgence</Label>
        <Select
          id="urgency"
          ariaLabel="Urgence"
          value={urgency}
          onChange={(v) => onUrgencyChange(v as Urgency)}
          items={[...URGENCY_OPTIONS]}
          tabIndex={6}
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
      <Input
        id="notes"
        aria-label="Notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={500}
        tabIndex={7}
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
