'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { PlanningDriverOption } from '../_lib/planning-queries';

export interface PlanningFilterState {
  driver: string; // '' = tous · '__unassigned__' = non affectées · sinon id chauffeur
  vehicle: string;
  type: string;
  donneur: string;
  patient: string;
}

export const EMPTY_FILTERS: PlanningFilterState = {
  driver: '',
  vehicle: '',
  type: '',
  donneur: '',
  patient: '',
};

export const UNASSIGNED_FILTER = '__unassigned__';

interface Option {
  value: string;
  label: string;
}

interface Props {
  filters: PlanningFilterState;
  onChange: (next: PlanningFilterState) => void;
  drivers: PlanningDriverOption[];
  vehicles: Option[];
  types: Option[];
  donneurs: Option[];
}

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-11 rounded-md border px-8 text-sm ' +
  'focus-visible:outline-none focus-visible:ring-2';

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-4">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

/**
 * Barre de filtres du planning (Module 5.12 lot A) — LECTURE : chauffeur,
 * véhicule, type de course, donneur d'ordres, patient. Aucune persistance
 * (option simple). Les options sont dérivées des courses affichées.
 */
export function PlanningFilters({
  filters,
  onChange,
  drivers,
  vehicles,
  types,
  donneurs,
}: Props): JSX.Element {
  const set = (patch: Partial<PlanningFilterState>): void => onChange({ ...filters, ...patch });
  const active =
    filters.driver || filters.vehicle || filters.type || filters.donneur || filters.patient;

  return (
    <div className="flex flex-wrap items-end gap-12">
      <Field label="Chauffeur">
        <select
          className={cn(SELECT_CLASS)}
          value={filters.driver}
          onChange={(e) => set({ driver: e.target.value })}
        >
          <option value="">Tous</option>
          <option value={UNASSIGNED_FILTER}>Non affectées</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Véhicule">
        <select
          className={cn(SELECT_CLASS)}
          value={filters.vehicle}
          onChange={(e) => set({ vehicle: e.target.value })}
        >
          <option value="">Tous</option>
          {vehicles.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Type">
        <select
          className={cn(SELECT_CLASS)}
          value={filters.type}
          onChange={(e) => set({ type: e.target.value })}
        >
          <option value="">Tous</option>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Donneur d'ordres">
        <select
          className={cn(SELECT_CLASS)}
          value={filters.donneur}
          onChange={(e) => set({ donneur: e.target.value })}
        >
          <option value="">Tous</option>
          {donneurs.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Patient">
        <Input
          type="search"
          value={filters.patient}
          placeholder="Nom du patient"
          onChange={(e) => set({ patient: e.target.value })}
          className="w-[180px]"
        />
      </Field>

      {active ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-primary h-11 text-sm font-medium hover:underline"
        >
          Réinitialiser
        </button>
      ) : null}
    </div>
  );
}
