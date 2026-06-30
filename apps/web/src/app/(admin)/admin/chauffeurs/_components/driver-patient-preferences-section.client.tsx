'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, UserX, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PatientPickerField } from '@/app/(app)/courses/_components/ride-patient-picker.client';
import {
  addPatientPreferenceAction,
  getDriverPatientPreferencesAction,
  removePatientPreferenceAction,
} from '../preferences.actions';
import type { DriverPatientPreferenceItem } from '../_lib/patient-preferences';

type Kind = 'prefere' | 'evite';

function PatientPrefList({
  items,
  driverId,
  emptyLabel,
  onChanged,
}: {
  items: DriverPatientPreferenceItem[];
  driverId: string;
  emptyLabel: string;
  onChanged: () => void;
}): JSX.Element {
  async function remove(preferenceId: string): Promise<void> {
    const res = await removePatientPreferenceAction({ driverId, preferenceId });
    if (res.error) {
      toast.error(res.error);
      return;
    }
    onChanged();
  }
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-border border-border divide-y rounded-md border">
      {items.map((i) => (
        <li key={i.id} className="flex items-center justify-between gap-12 p-12">
          <span className="truncate text-sm">{i.patient_name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void remove(i.id)}
            aria-label={`Retirer ${i.patient_name}`}
          >
            <X className="h-12 w-12" aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Section « Patients préférés / évités » de la fiche chauffeur (CHAUFFEUR-03,
 * §5.6) — miroir de la section côté patient. Sans motif. Auto-chargée via
 * Server Action (le drawer ne porte pas la donnée). Réutilise le picker patient.
 */
export function DriverPatientPreferencesSection({ driverId }: { driverId: string }): JSX.Element {
  const qc = useQueryClient();
  const prefsQuery = useQuery({
    queryKey: ['driver-patient-preferences', driverId],
    queryFn: () => getDriverPatientPreferencesAction(driverId),
    staleTime: 30_000,
  });
  const [kind, setKind] = React.useState<Kind>('prefere');
  const [patientId, setPatientId] = React.useState('');
  const [patientLabel, setPatientLabel] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  const refetch = React.useCallback(
    () => void qc.invalidateQueries({ queryKey: ['driver-patient-preferences', driverId] }),
    [qc, driverId],
  );

  function add(): void {
    if (!patientId) return;
    startTransition(async () => {
      const res = await addPatientPreferenceAction({ driverId, patientId, kind });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setPatientId('');
      setPatientLabel('');
      refetch();
    });
  }

  const prefere = prefsQuery.data?.prefere ?? [];
  const evite = prefsQuery.data?.evite ?? [];

  return (
    <div className="space-y-12">
      <div className="grid gap-16 sm:grid-cols-2">
        <div className="space-y-8">
          <div className="flex items-center gap-8 text-sm font-medium">
            <Star className="text-success h-16 w-16" aria-hidden />
            Patients préférés
          </div>
          <PatientPrefList
            items={prefere}
            driverId={driverId}
            emptyLabel="Aucun patient préféré."
            onChanged={refetch}
          />
        </div>
        <div className="space-y-8">
          <div className="flex items-center gap-8 text-sm font-medium">
            <UserX className="text-muted-foreground h-16 w-16" aria-hidden />
            Patients à éviter
          </div>
          <PatientPrefList
            items={evite}
            driverId={driverId}
            emptyLabel="Aucun patient à éviter."
            onChanged={refetch}
          />
        </div>
      </div>

      <div className="space-y-8">
        <Label htmlFor="patient-pref-kind">Type</Label>
        <Select
          ariaLabel="Type de préférence"
          value={kind}
          onChange={(v) => setKind(v as Kind)}
          items={[
            { value: 'prefere', label: 'Préféré' },
            { value: 'evite', label: 'À éviter' },
          ]}
          triggerClassName="w-[160px]"
        />
      </div>

      <PatientPickerField
        selectedLabel={patientLabel}
        onSelect={(id, label) => {
          setPatientId(id);
          setPatientLabel(label);
        }}
      />

      <Button type="button" variant="outline" onClick={add} disabled={!patientId || pending}>
        Ajouter
      </Button>
    </div>
  );
}
