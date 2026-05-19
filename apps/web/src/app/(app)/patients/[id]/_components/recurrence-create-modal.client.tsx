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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRecurrenceAction } from '../../actions/recurrences';
import { useHolidays974 } from '../_lib/use-holidays-974';
import { RecurrencePreview } from './recurrence-preview.client';

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}): JSX.Element {
  const [days, setDays] = useState<string[]>(['MO', 'WE', 'FR']);
  const [hour, setHour] = useState('08:00');
  const [startDate, setStartDate] = useState('');
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
    startTransition(async () => {
      const result = await createRecurrenceAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      onOpenChange(false);
      setDays(['MO', 'WE', 'FR']);
      setStartDate('');
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nouvelle récurrence</DialogTitle>
          <DialogDescription>
            Génération automatique des courses sur 3 mois (DEC-047). Les jours
            fériés 974 sont sautés.
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
              <Input
                id="rec-hour"
                type="time"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                required
              />
            </div>
            <div className="space-y-4">
              <Label htmlFor="rec-start">Date de début</Label>
              <Input
                id="rec-start"
                name="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label htmlFor="rec-end">Date de fin (optionnelle)</Label>
            <Input id="rec-end" name="end_date" type="date" />
          </div>

          <div className="space-y-4">
            <Label htmlFor="rec-pickup">Adresse de prise en charge</Label>
            <Input
              id="rec-pickup"
              name="pickup_address"
              type="text"
              placeholder="12 rue de Paris, Saint-Denis"
              required
            />
          </div>

          <div className="space-y-4">
            <Label htmlFor="rec-dropoff">Adresse de destination</Label>
            <Input
              id="rec-dropoff"
              name="dropoff_address"
              type="text"
              placeholder="CHU Félix Guyon"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-4">
              <Label htmlFor="rec-mode">Mode de transport</Label>
              <select
                id="rec-mode"
                name="transport_mode"
                defaultValue="vsl"
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-12 text-sm"
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
                className="flex h-10 w-full rounded-md border border-input bg-background px-12 text-sm"
              >
                <option value="normale">Normale</option>
                <option value="prioritaire">Prioritaire</option>
              </select>
            </div>
          </div>

          <RecurrencePreview
            rruleStr={rruleStr}
            startDate={startDate}
            holidays974={holidays974}
          />

          {error && (
            <p role="alert" className="text-sm text-destructive">
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
            <Button type="submit" disabled={pending || days.length === 0}>
              {pending ? 'Création…' : 'Créer occurrences'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
