'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
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
import { updateRecurrenceAction } from '../../actions/recurrences';
import type { RideRecurrence } from '@/types/recurrence';
import { useHolidays974 } from '../_lib/use-holidays-974';
import { RecurrencePreview } from './recurrence-preview.client';

type Coords = { lat: number | null; lng: number | null; citycode: string | null };

const DAY_OPTIONS: { code: string; label: string }[] = [
  { code: 'MO', label: 'Lun' },
  { code: 'TU', label: 'Mar' },
  { code: 'WE', label: 'Mer' },
  { code: 'TH', label: 'Jeu' },
  { code: 'FR', label: 'Ven' },
  { code: 'SA', label: 'Sam' },
  { code: 'SU', label: 'Dim' },
];

function parseDaysFromRrule(rrule: string): string[] {
  const match = rrule.match(/BYDAY=([^;]+)/);
  const captured = match?.[1];
  return captured ? captured.split(',').filter(Boolean) : [];
}

function parseHourFromRrule(rrule: string): string {
  const hourMatch = rrule.match(/BYHOUR=(\d+)/);
  const minuteMatch = rrule.match(/BYMINUTE=(\d+)/);
  const hh = (hourMatch?.[1] ?? '08').padStart(2, '0');
  const mm = (minuteMatch?.[1] ?? '00').padStart(2, '0');
  return `${hh}:${mm}`;
}

function buildRrule(days: string[], hour: string): string {
  const [hh, mm] = hour.split(':').map((s) => Number.parseInt(s, 10));
  const hourInt = Number.isFinite(hh) ? hh : 8;
  const minuteInt = Number.isFinite(mm) ? mm : 0;
  return `FREQ=WEEKLY;BYDAY=${days.join(',')};BYHOUR=${hourInt};BYMINUTE=${minuteInt}`;
}

export function RecurrenceEditModal({
  open,
  onOpenChange,
  recurrence,
  futureCount,
  prescriptionOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recurrence: RideRecurrence;
  futureCount: number;
  prescriptionOptions: { id: string; numero: string }[];
}): JSX.Element {
  const [days, setDays] = useState<string[]>(parseDaysFromRrule(recurrence.rrule_str));
  const [hour, setHour] = useState(parseHourFromRrule(recurrence.rrule_str));
  const [startDate, setStartDate] = useState(recurrence.start_date);
  const [endDate, setEndDate] = useState(recurrence.end_date ?? '');
  const [pickupAddress, setPickupAddress] = useState(recurrence.pickup_address);
  const [pickupCoords, setPickupCoords] = useState<Coords>({
    lat: recurrence.pickup_lat ?? null,
    lng: recurrence.pickup_lng ?? null,
    citycode: recurrence.pickup_citycode ?? null,
  });
  const [dropoffAddress, setDropoffAddress] = useState(recurrence.dropoff_address);
  const [dropoffCoords, setDropoffCoords] = useState<Coords>({
    lat: recurrence.dropoff_lat ?? null,
    lng: recurrence.dropoff_lng ?? null,
    citycode: recurrence.dropoff_citycode ?? null,
  });
  const [transportMode, setTransportMode] = useState(recurrence.transport_mode);
  const [urgency, setUrgency] = useState(recurrence.urgency);
  const [prescriptionId, setPrescriptionId] = useState(recurrence.prescription_id ?? '');
  const [showCascadeConfirm, setShowCascadeConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const holidays974 = useHolidays974();
  const rruleStr = days.length > 0 ? buildRrule(days, hour) : '';

  function toggleDay(code: string): void {
    setDays((current) =>
      current.includes(code) ? current.filter((d) => d !== code) : [...current, code],
    );
  }

  function confirmAndSubmit(): void {
    setError(null);
    const formData = new FormData();
    formData.set('id', recurrence.id);
    formData.set('patient_id', recurrence.patient_id);
    formData.set('rrule_str', rruleStr);
    formData.set('start_date', startDate);
    if (endDate) formData.set('end_date', endDate);
    formData.set('pickup_address', pickupAddress);
    formData.set('dropoff_address', dropoffAddress);
    // DEC-094 : threadage coords picker → Server Action (filet serveur si null).
    if (pickupCoords.lat != null) formData.set('pickup_lat', String(pickupCoords.lat));
    if (pickupCoords.lng != null) formData.set('pickup_lng', String(pickupCoords.lng));
    if (pickupCoords.citycode) formData.set('pickup_citycode', pickupCoords.citycode);
    if (dropoffCoords.lat != null) formData.set('dropoff_lat', String(dropoffCoords.lat));
    if (dropoffCoords.lng != null) formData.set('dropoff_lng', String(dropoffCoords.lng));
    if (dropoffCoords.citycode) formData.set('dropoff_citycode', dropoffCoords.citycode);
    formData.set('transport_mode', transportMode);
    formData.set('urgency', urgency);
    // RENOUVELLEMENT-01 : bon rattaché (vide → omis → lien effacé côté action).
    if (prescriptionId) formData.set('prescription_id', prescriptionId);

    startTransition(async () => {
      const result = await updateRecurrenceAction(formData);
      if (result.error) {
        setError(result.error);
        setShowCascadeConfirm(false);
        return;
      }
      setShowCascadeConfirm(false);
      onOpenChange(false);
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier la récurrence</DialogTitle>
            <DialogDescription>
              Toute modification impactera les occurrences futures non démarrées.
            </DialogDescription>
          </DialogHeader>

          {futureCount > 0 && (
            <div
              role="alert"
              className="flex gap-12 rounded-md border border-amber-200 bg-amber-50 p-12 text-sm text-amber-900"
            >
              <AlertTriangle aria-hidden className="h-16 w-16 shrink-0" />
              <p>
                <strong>{futureCount}</strong>{' '}
                {futureCount > 1 ? 'occurrences seront supprimées' : 'occurrence sera supprimée'} et
                régénérée(s). Les courses en cours, terminées ou annulées sont préservées.
              </p>
            </div>
          )}

          <div className="space-y-16">
            <div className="space-y-8">
              <Label>Jours de la semaine</Label>
              <div className="flex flex-wrap gap-8">
                {DAY_OPTIONS.map(({ code, label }) => {
                  const active = days.includes(code);
                  return (
                    <button
                      key={code}
                      type="button"
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
                <Label htmlFor="edit-hour">Heure</Label>
                <TimeField24 id="edit-hour" value={hour} onChange={setHour} />
              </div>
              <div className="space-y-4">
                <Label htmlFor="edit-start">Date de début</Label>
                <DateFieldFr id="edit-start" value={startDate} onChange={setStartDate} />
              </div>
            </div>

            <div className="space-y-4">
              <Label htmlFor="edit-end">Date de fin (optionnelle)</Label>
              <DateFieldFr id="edit-end" value={endDate} onChange={setEndDate} />
            </div>

            <AddressOrPOIPicker
              id="edit-pickup"
              label="Adresse de prise en charge"
              ariaLabel="Adresse de prise en charge de la récurrence"
              value={pickupAddress}
              onChange={(v) => {
                setPickupAddress(v);
                if (pickupCoords.lat != null)
                  setPickupCoords({ lat: null, lng: null, citycode: null });
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
              id="edit-dropoff"
              label="Adresse de destination"
              ariaLabel="Adresse de destination de la récurrence"
              value={dropoffAddress}
              onChange={(v) => {
                setDropoffAddress(v);
                if (dropoffCoords.lat != null)
                  setDropoffCoords({ lat: null, lng: null, citycode: null });
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
                <Label htmlFor="edit-mode">Mode de transport</Label>
                <select
                  id="edit-mode"
                  value={transportMode}
                  onChange={(e) =>
                    setTransportMode(e.target.value as RideRecurrence['transport_mode'])
                  }
                  className="border-input bg-background flex h-10 w-full rounded-md border px-12 text-sm"
                >
                  <option value="vsl">VSL</option>
                  <option value="taxi_conventionne">Taxi conventionné</option>
                  <option value="tpmr">TPMR</option>
                </select>
              </div>
              <div className="space-y-4">
                <Label htmlFor="edit-urgency">Urgence</Label>
                <select
                  id="edit-urgency"
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as RideRecurrence['urgency'])}
                  className="border-input bg-background flex h-10 w-full rounded-md border px-12 text-sm"
                >
                  <option value="normale">Normale</option>
                  <option value="prioritaire">Prioritaire</option>
                </select>
              </div>
            </div>

            {prescriptionOptions.length > 0 && (
              <div className="space-y-4">
                <Label htmlFor="edit-prescription">Bon de transport (optionnel)</Label>
                <select
                  id="edit-prescription"
                  value={prescriptionId}
                  onChange={(e) => setPrescriptionId(e.target.value)}
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

            <RecurrencePreview
              rruleStr={rruleStr}
              startDate={startDate}
              holidays974={holidays974}
            />

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
          </div>

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
              type="button"
              onClick={() => setShowCascadeConfirm(true)}
              disabled={pending || days.length === 0}
            >
              Confirmer modification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCascadeConfirm} onOpenChange={setShowCascadeConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la cascade</DialogTitle>
            <DialogDescription>
              {futureCount > 0
                ? `${futureCount} occurrence(s) non démarrée(s) seront supprimées et regénérées.`
                : 'Aucune occurrence future à régénérer : seule la récurrence sera mise à jour.'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-muted-foreground text-xs">
            Préservées : courses en cours, terminées ou annulées.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCascadeConfirm(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmAndSubmit}
              disabled={pending}
            >
              {pending ? 'Application…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
