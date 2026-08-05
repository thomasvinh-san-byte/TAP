'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TimeField24 } from '@/components/time-field-24.client';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { AddressOrPOIPicker } from '@/app/(app)/courses/_components/address-or-poi-picker.client';
import { createRecurrenceAction } from '../../actions/recurrences';
import { useHolidays974 } from '../_lib/use-holidays-974';
import { RecurrencePreview } from './recurrence-preview.client';

type Coords = { lat: number | null; lng: number | null; citycode: string | null };
const EMPTY_COORDS: Coords = { lat: null, lng: null, citycode: null };

const DAY_OPTIONS: { code: string; label: string }[] = [
  { code: 'MO', label: 'Lun' },
  { code: 'TU', label: 'Mar' },
  { code: 'WE', label: 'Mer' },
  { code: 'TH', label: 'Jeu' },
  { code: 'FR', label: 'Ven' },
  { code: 'SA', label: 'Sam' },
  { code: 'SU', label: 'Dim' },
];

function buildRrule(days: string[], hour: string): string {
  const [hh, mm] = hour.split(':').map((s) => Number.parseInt(s, 10));
  const hourInt = Number.isFinite(hh) ? hh : 8;
  const minuteInt = Number.isFinite(mm) ? mm : 0;
  return `FREQ=WEEKLY;BYDAY=${days.join(',')};BYHOUR=${hourInt};BYMINUTE=${minuteInt}`;
}

export function RecurrenceCreateModal({
  open,
  onOpenChange,
  patientId,
  prescriptionOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  prescriptionOptions: { id: string; numero: string }[];
}): JSX.Element {
  const [days, setDays] = useState<string[]>(['MO', 'WE', 'FR']);
  const [hour, setHour] = useState('08:00');
  const [startDate, setStartDate] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupCoords, setPickupCoords] = useState<Coords>(EMPTY_COORDS);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<Coords>(EMPTY_COORDS);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const holidays974 = useHolidays974();
  const rruleStr = days.length > 0 ? buildRrule(days, hour) : '';

  function toggleDay(code: string): void {
    setDays((current) =>
      current.includes(code) ? current.filter((d) => d !== code) : [...current, code],
    );
  }

  function handleSubmit(formData: FormData): void {
    setError(null);
    formData.set('rrule_str', rruleStr);
    formData.set('patient_id', patientId);
    formData.set('pickup_address', pickupAddress);
    formData.set('dropoff_address', dropoffAddress);
    // DEC-094 : threadage coords picker → Server Action (filet serveur si null).
    if (pickupCoords.lat != null) formData.set('pickup_lat', String(pickupCoords.lat));
    if (pickupCoords.lng != null) formData.set('pickup_lng', String(pickupCoords.lng));
    if (pickupCoords.citycode) formData.set('pickup_citycode', pickupCoords.citycode);
    if (dropoffCoords.lat != null) formData.set('dropoff_lat', String(dropoffCoords.lat));
    if (dropoffCoords.lng != null) formData.set('dropoff_lng', String(dropoffCoords.lng));
    if (dropoffCoords.citycode) formData.set('dropoff_citycode', dropoffCoords.citycode);
    startTransition(async () => {
      const result = await createRecurrenceAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      setDays(['MO', 'WE', 'FR']);
      setStartDate('');
      setPickupAddress('');
      setPickupCoords(EMPTY_COORDS);
      setDropoffAddress('');
      setDropoffCoords(EMPTY_COORDS);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle récurrence</DialogTitle>
          <DialogDescription>
            Génération automatique des courses sur 3 mois (DEC-047). Les jours fériés 974 sont
            sautés.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-16">
          <div className="space-y-8">
            <Label>Jours de la semaine</Label>
            <div className="flex flex-wrap gap-8">
              {DAY_OPTIONS.map(({ code, label }) => {
                const active = days.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    data-day={code}
                    onClick={() => toggleDay(code)}
                    aria-pressed={active}
                    className={
                      'h-10 min-w-[3rem] rounded-md border px-12 text-sm font-medium transition ' +
                      (active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background hover:bg-muted')
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <Label htmlFor="rec-hour">Heure</Label>
              <TimeField24 id="rec-hour" value={hour} onChange={setHour} />
            </div>
            <div className="space-y-4">
              <Label htmlFor="rec-start">Date de début</Label>
              <DateFieldFr
                id="rec-start"
                name="start_date"
                value={startDate}
                onChange={setStartDate}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="rec-end">Date de fin (optionnelle)</Label>
            <DateFieldFr id="rec-end" name="end_date" />
          </div>

          <AddressOrPOIPicker
            id="rec-pickup"
            label="Adresse de prise en charge"
            ariaLabel="Adresse de prise en charge de la récurrence"
            value={pickupAddress}
            onChange={(v) => {
              setPickupAddress(v);
              if (pickupCoords.lat != null) setPickupCoords(EMPTY_COORDS);
            }}
            onSelect={(sel) =>
              setPickupCoords({
                lat: sel.lat ?? null,
                lng: sel.lng ?? null,
                citycode: sel.citycode ?? null,
              })
            }
          />

          <AddressOrPOIPicker
            id="rec-dropoff"
            label="Adresse de destination"
            ariaLabel="Adresse de destination de la récurrence"
            value={dropoffAddress}
            onChange={(v) => {
              setDropoffAddress(v);
              if (dropoffCoords.lat != null) setDropoffCoords(EMPTY_COORDS);
            }}
            onSelect={(sel) =>
              setDropoffCoords({
                lat: sel.lat ?? null,
                lng: sel.lng ?? null,
                citycode: sel.citycode ?? null,
              })
            }
          />

          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <Label htmlFor="rec-mode">Mode de transport</Label>
              <select
                id="rec-mode"
                name="transport_mode"
                defaultValue="vsl"
                required
                className="border-input bg-background flex h-10 w-full rounded-md border px-12 text-sm"
              >
                <option value="vsl">VSL</option>
                <option value="taxi_conventionne">Taxi conventionné</option>
                <option value="tpmr">TPMR</option>
              </select>
            </div>
            <div className="space-y-4">
              <Label htmlFor="rec-urgency">Urgence</Label>
              <select
                id="rec-urgency"
                name="urgency"
                defaultValue="normale"
                className="border-input bg-background flex h-10 w-full rounded-md border px-12 text-sm"
              >
                <option value="normale">Normale</option>
                <option value="prioritaire">Prioritaire</option>
              </select>
            </div>
          </div>

          {prescriptionOptions.length > 0 && (
            <div className="space-y-4">
              <Label htmlFor="rec-prescription">Bon de transport (optionnel)</Label>
              <select
                id="rec-prescription"
                name="prescription_id"
                defaultValue=""
                className="border-input bg-background flex h-10 w-full rounded-md border px-12 text-sm"
              >
                <option value="">Aucun bon rattaché</option>
                {prescriptionOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    Bon {p.numero}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Rattacher un bon permet l&apos;alerte de renouvellement anticipé (15 jours).
              </p>
            </div>
          )}

          <RecurrencePreview rruleStr={rruleStr} startDate={startDate} holidays974={holidays974} />

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={
                pending ||
                days.length === 0 ||
                pickupAddress.trim().length === 0 ||
                dropoffAddress.trim().length === 0
              }
            >
              {pending ? 'Création…' : 'Créer occurrences'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
