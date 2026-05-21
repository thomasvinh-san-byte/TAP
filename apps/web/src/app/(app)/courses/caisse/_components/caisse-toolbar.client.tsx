'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { exportCaisseCsvAction } from '../../actions';
import type { CaisseFilters } from '../_lib/queries-caisse';

/**
 * CaisseToolbar — date input + filtre chauffeur + bouton Export CSV.
 *
 * Navigation date via Next router (push avec searchParams).
 * Export CSV : appel Server Action → Blob download client-side.
 *
 * Refs : UI-SPEC Surface C toolbar.
 */

interface DriverMin {
  id: string;
  nom_affichage: string;
}

interface Props {
  date: string;
  drivers: DriverMin[];
  filters: CaisseFilters;
}

export function CaisseToolbar({ date, drivers, filters }: Props): JSX.Element {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const updateUrl = (next: Partial<CaisseFilters>) => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    if (merged.date) params.set('date', merged.date);
    if (merged.driverId) params.set('driver_id', merged.driverId);
    if (merged.paymentMethod) params.set('payment_method', merged.paymentMethod);
    if (merged.sort) params.set('sort', merged.sort);
    if (merged.dir) params.set('dir', merged.dir);
    router.push(`/courses/caisse?${params.toString()}`);
  };

  const onExport = async () => {
    setPending(true);
    const res = await exportCaisseCsvAction({
      date,
      driverId: filters.driverId,
      paymentMethod: filters.paymentMethod,
    });
    setPending(false);
    if (res.error || !res.csv || !res.filename) {
      toast.error(res.error ?? 'Export impossible.');
      return;
    }
    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Export terminé : ${res.filename}`);
  };

  return (
    <div className="flex flex-wrap items-end justify-between gap-12">
      <div className="flex flex-wrap items-end gap-12">
        <div className="space-y-4">
          <Label htmlFor="caisse-date" className="text-xs">
            Date
          </Label>
          <Input
            id="caisse-date"
            type="date"
            value={date}
            onChange={(e) => updateUrl({ date: e.target.value })}
            className="h-10 w-[160px] tabular-nums"
          />
        </div>
        <div className="space-y-4">
          <Label htmlFor="caisse-driver" className="text-xs">
            Chauffeur
          </Label>
          <select
            id="caisse-driver"
            value={filters.driverId ?? ''}
            onChange={(e) => updateUrl({ driverId: e.target.value || undefined })}
            className="border-border bg-background h-10 w-[200px] rounded-md border px-12 text-sm"
          >
            <option value="">Tous chauffeurs</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom_affichage}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button type="button" onClick={() => void onExport()} disabled={pending} className="gap-8">
        <Download className="h-16 w-16" aria-hidden />
        {pending ? 'Export…' : 'Exporter CSV'}
      </Button>
    </div>
  );
}
