'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { exportCaisseCsvAction } from '../../actions';
import type { CaisseFilters } from '../_lib/queries-caisse';

/**
 * CaisseToolbar — switch de vue (encaissées / à encaisser) + filtres + export.
 *
 * Navigation par URL (Next router push avec searchParams). CAISSE-01 : la vue
 * « à encaisser » est un STOCK → on masque le sélecteur de date (jour) et
 * l'export CSV (qui porte sur le journal encaissé) ; le filtre chauffeur reste
 * utile dans les deux vues.
 *
 * Refs : UI-SPEC Surface C toolbar.
 */

export type CaisseVue = 'encaissees' | 'a_encaisser';

interface DriverMin {
  id: string;
  nom_affichage: string;
}

interface Props {
  vue: CaisseVue;
  date: string;
  drivers: DriverMin[];
  filters: CaisseFilters;
}

export function CaisseToolbar({ vue, date, drivers, filters }: Props): JSX.Element {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // Construit l'URL en conservant la vue courante + les filtres pertinents.
  const buildUrl = (nextVue: CaisseVue, next: Partial<CaisseFilters>): string => {
    const params = new URLSearchParams();
    const merged = { ...filters, ...next };
    if (nextVue === 'a_encaisser') params.set('vue', 'a_encaisser');
    if (merged.driverId) params.set('driver_id', merged.driverId);
    // Date / mode / tri n'ont de sens que pour le journal encaissé (un jour).
    if (nextVue === 'encaissees') {
      if (merged.date) params.set('date', merged.date);
      if (merged.paymentMethod) params.set('payment_method', merged.paymentMethod);
      if (merged.sort) params.set('sort', merged.sort);
      if (merged.dir) params.set('dir', merged.dir);
    }
    return `/courses/caisse?${params.toString()}`;
  };

  const updateUrl = (next: Partial<CaisseFilters>) => {
    router.push(buildUrl(vue, next));
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

  const aEncaisser = vue === 'a_encaisser';

  return (
    <div className="space-y-12">
      {/* Switch de vue (segmented control) piloté par URL. */}
      <div
        className="border-border inline-flex rounded-md border p-2"
        role="tablist"
        aria-label="Vue de la caisse"
      >
        <Button
          type="button"
          size="sm"
          variant={aEncaisser ? 'ghost' : 'default'}
          role="tab"
          aria-selected={!aEncaisser}
          onClick={() => router.push(buildUrl('encaissees', {}))}
        >
          Encaissées
        </Button>
        <Button
          type="button"
          size="sm"
          variant={aEncaisser ? 'default' : 'ghost'}
          role="tab"
          aria-selected={aEncaisser}
          onClick={() => router.push(buildUrl('a_encaisser', {}))}
        >
          À encaisser
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-12">
        <div className="flex flex-wrap items-end gap-12">
          {/* Date : sélecteur de jour uniquement pour le journal encaissé. */}
          {!aEncaisser && (
            <div className="space-y-4">
              <Label htmlFor="caisse-date" className="text-xs">
                Date
              </Label>
              <DateFieldFr
                id="caisse-date"
                value={date}
                onChange={(v) => updateUrl({ date: v })}
                className="h-10 w-[160px] tabular-nums"
              />
            </div>
          )}
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
        {/* Export CSV : journal encaissé seulement (sans objet pour un stock). */}
        {!aEncaisser && (
          <Button
            type="button"
            onClick={() => void onExport()}
            disabled={pending}
            className="gap-8"
          >
            <Download className="h-16 w-16" aria-hidden />
            {pending ? 'Export…' : 'Exporter CSV'}
          </Button>
        )}
      </div>
    </div>
  );
}
