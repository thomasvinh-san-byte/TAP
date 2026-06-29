'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { createPatientIncidentAction } from '../../actions';
import {
  PATIENT_INCIDENT_TYPES,
  PATIENT_INCIDENT_TYPE_LABELS,
  type PatientIncidentType,
} from '../_lib/incident-escalade';

export interface IncidentRideOption {
  id: string;
  label: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Formulaire de saisie d'un incident patient (journal immuable). */
export function PatientIncidentForm({
  patientId,
  rideOptions,
  onDone,
  onCancel,
}: {
  patientId: string;
  rideOptions: IncidentRideOption[];
  onDone: () => void;
  onCancel: () => void;
}): JSX.Element {
  const [type, setType] = React.useState<PatientIncidentType>('retard');
  const [note, setNote] = React.useState('');
  const [occurredOn, setOccurredOn] = React.useState(todayIso());
  const [rideId, setRideId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const res = await createPatientIncidentAction({
        patientId,
        type,
        note: note.trim() || undefined,
        occurredAt: new Date(`${occurredOn}T12:00:00.000Z`).toISOString(),
        rideId: rideId || undefined,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      toast.success('Incident enregistré.');
      onDone();
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Signaler un incident</SheetTitle>
        <SheetDescription>
          L&apos;incident est ajouté à l&apos;historique du patient. Cet historique est consultable
          mais non modifiable.
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-16 py-16">
        <div className="space-y-8">
          <Label htmlFor="incident-type">Type d&apos;incident</Label>
          <Select
            ariaLabel="Type d'incident"
            value={type}
            onChange={(v) => setType(v as PatientIncidentType)}
            items={PATIENT_INCIDENT_TYPES.map((t) => ({
              value: t,
              label: PATIENT_INCIDENT_TYPE_LABELS[t],
            }))}
            triggerClassName="w-full"
          />
        </div>

        <div className="space-y-8">
          <Label htmlFor="incident-date">Date de l&apos;incident</Label>
          <DateFieldFr id="incident-date" value={occurredOn} onChange={setOccurredOn} />
        </div>

        {rideOptions.length > 0 && (
          <div className="space-y-8">
            <Label htmlFor="incident-ride">Course concernée (facultatif)</Label>
            <Select
              ariaLabel="Course concernée"
              value={rideId}
              onChange={setRideId}
              placeholder="Aucune"
              items={rideOptions.map((r) => ({ value: r.id, label: r.label }))}
              triggerClassName="w-full"
            />
          </div>
        )}

        <div className="space-y-8">
          <Label htmlFor="incident-note">Note (facultatif)</Label>
          <Textarea
            id="incident-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Précisions sur l'incident"
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
      </div>

      <SheetFooter>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="button" variant="accent" onClick={submit} disabled={pending}>
          {pending ? 'Enregistrement…' : "Enregistrer l'incident"}
        </Button>
      </SheetFooter>
    </>
  );
}
