'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { exportCaisseReportByDriverCsvAction } from '../../actions';

/**
 * Déclencheur du rapport de caisse PAR CHAUFFEUR sur une période (CAISSE-02,
 * CdG §5.19). Deux champs date (from/to) + bouton → action serveur → CSV agrégé
 * téléchargé côté client (même mécanisme Blob que l'export plat). Le filtre
 * chauffeur courant est conservé (rapport mono-chauffeur si positionné).
 */
function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CaisseReportButton({ driverId }: { driverId?: string }): JSX.Element {
  const [from, setFrom] = React.useState(firstOfMonthIso());
  const [to, setTo] = React.useState(todayIso());
  const [pending, setPending] = React.useState(false);

  const onGenerate = async () => {
    setPending(true);
    const res = await exportCaisseReportByDriverCsvAction({ from, to, driverId });
    setPending(false);
    if (res.error || !res.csv || !res.filename) {
      toast.error(res.error ?? 'Rapport impossible.');
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
    toast.success(`Rapport téléchargé : ${res.filename}`);
  };

  return (
    <div className="border-border flex flex-wrap items-end gap-12 rounded-md border border-dashed p-12">
      <p className="text-muted-foreground w-full text-xs font-medium uppercase tracking-wide">
        Rapport par chauffeur (période)
      </p>
      <div className="space-y-4">
        <Label htmlFor="report-from" className="text-xs">
          Du
        </Label>
        <DateFieldFr
          id="report-from"
          value={from}
          onChange={(v) => setFrom(v)}
          className="h-10 w-[160px] tabular-nums"
        />
      </div>
      <div className="space-y-4">
        <Label htmlFor="report-to" className="text-xs">
          Au
        </Label>
        <DateFieldFr
          id="report-to"
          value={to}
          onChange={(v) => setTo(v)}
          className="h-10 w-[160px] tabular-nums"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => void onGenerate()}
        disabled={pending}
        className="gap-8"
      >
        <FileSpreadsheet className="h-16 w-16" aria-hidden />
        {pending ? 'Génération…' : 'Rapport par chauffeur'}
      </Button>
    </div>
  );
}
