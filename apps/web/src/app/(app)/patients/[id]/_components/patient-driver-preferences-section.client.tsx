'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Star, UserX, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { addDriverPreferenceAction, removeDriverPreferenceAction } from '../../actions';

export interface DriverOption {
  id: string;
  label: string;
}

export interface DriverPreferenceItem {
  id: string;
  driver_id: string;
  driver_name: string;
}

type Kind = 'prefere' | 'evite';

function PreferenceList({
  items,
  patientId,
  emptyLabel,
  onChanged,
}: {
  items: DriverPreferenceItem[];
  patientId: string;
  emptyLabel: string;
  onChanged: () => void;
}): JSX.Element {
  async function remove(preferenceId: string): Promise<void> {
    const res = await removeDriverPreferenceAction({ patientId, preferenceId });
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
          <span className="truncate text-sm">{i.driver_name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void remove(i.id)}
            aria-label={`Retirer ${i.driver_name}`}
          >
            <X className="h-12 w-12" aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function PatientDriverPreferencesSection({
  patientId,
  prefere,
  evite,
  driverOptions,
}: {
  patientId: string;
  prefere: DriverPreferenceItem[];
  evite: DriverPreferenceItem[];
  driverOptions: DriverOption[];
}): JSX.Element {
  const router = useRouter();
  const [kind, setKind] = React.useState<Kind>('prefere');
  const [driverId, setDriverId] = React.useState('');
  const [pending, startTransition] = React.useTransition();

  function add(): void {
    if (!driverId) return;
    startTransition(async () => {
      const res = await addDriverPreferenceAction({ patientId, driverId, kind });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setDriverId('');
      router.refresh();
    });
  }

  return (
    <section className="space-y-12">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        Préférences de chauffeur
      </h2>

      <div className="grid gap-16 sm:grid-cols-2">
        <div className="space-y-8">
          <div className="flex items-center gap-8 text-sm font-medium">
            <Star className="text-success h-16 w-16" aria-hidden />
            Préférés
          </div>
          <PreferenceList
            items={prefere}
            patientId={patientId}
            emptyLabel="Aucun chauffeur préféré."
            onChanged={() => router.refresh()}
          />
        </div>
        <div className="space-y-8">
          <div className="flex items-center gap-8 text-sm font-medium">
            <UserX className="text-muted-foreground h-16 w-16" aria-hidden />À éviter
          </div>
          <PreferenceList
            items={evite}
            patientId={patientId}
            emptyLabel="Aucun chauffeur à éviter."
            onChanged={() => router.refresh()}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-12">
        <div className="space-y-8">
          <Label htmlFor="pref-kind">Type</Label>
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
        <div className="min-w-[220px] flex-1 space-y-8">
          <Label htmlFor="pref-driver">Chauffeur</Label>
          <Select
            ariaLabel="Chauffeur"
            value={driverId}
            onChange={setDriverId}
            placeholder="Choisir un chauffeur"
            items={driverOptions.map((d) => ({ value: d.id, label: d.label }))}
            triggerClassName="w-full"
          />
        </div>
        <Button type="button" variant="outline" onClick={add} disabled={!driverId || pending}>
          Ajouter
        </Button>
      </div>
    </section>
  );
}
