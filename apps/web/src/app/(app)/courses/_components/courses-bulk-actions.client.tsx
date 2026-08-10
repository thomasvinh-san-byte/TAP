'use client';

import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportRidesCsvAction } from '../actions';

/**
 * Barre d'actions groupées sur la sélection de courses (Lot 4/4).
 *
 * Visible uniquement quand au moins une course est sélectionnée (rend `null`
 * sinon). Fondée sur les vrais patterns de dispatch NEMT : PAS d'affectation en
 * lot (chevauchements de créneaux — l'affectation reste unitaire via le drawer ou
 * l'optimiseur). Actions proposées : exporter la sélection (+ désaffecter en lot,
 * ajouté dans un second temps).
 */
export function CoursesBulkActions({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}): JSX.Element | null {
  const [exporting, setExporting] = useState(false);
  const count = selectedIds.length;
  if (count === 0) return null;

  async function onExport() {
    setExporting(true);
    // Réutilise l'export CSV existant, étendu pour cibler une liste d'ids
    // (mêmes colonnes / format que l'export par plage).
    const res = await exportRidesCsvAction({ ids: selectedIds });
    setExporting(false);
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
  }

  return (
    <div
      role="region"
      aria-label="Actions groupées sur la sélection"
      className="border-border bg-muted/40 flex flex-wrap items-center gap-12 rounded-md border px-16 py-12"
    >
      <span className="text-sm font-medium" aria-live="polite">
        {count} course{count > 1 ? 's' : ''} sélectionnée{count > 1 ? 's' : ''}
      </span>
      <div className="flex flex-wrap items-center gap-8">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void onExport()}
          disabled={exporting}
          className="gap-4"
        >
          <Download className="h-12 w-12" aria-hidden />
          {exporting ? 'Export…' : 'Exporter la sélection'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClear} className="gap-4">
          <X className="h-12 w-12" aria-hidden />
          Tout désélectionner
        </Button>
      </div>
    </div>
  );
}
