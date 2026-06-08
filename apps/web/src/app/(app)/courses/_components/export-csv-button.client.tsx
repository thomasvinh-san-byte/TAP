'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportRidesCsvAction, type ExportRidesInput } from '../actions';

/**
 * Bouton « Exporter CSV » de la toolbar Courses (Phase 06.37 §5.23,
 * DEC-116). Reprend le pattern de caisse-toolbar : Server Action →
 * Blob → download client.
 *
 * Si une date filter est posée → export jour entier ; sinon → 30
 * derniers jours (défaut sensé pour un export de pilotage).
 */

interface Props {
  dateFilter: string; // ISO 'YYYY-MM-DD' ou ''
  statusFilter: string;
  modeFilter: string;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExportCsvButton({ dateFilter, statusFilter, modeFilter }: Props): JSX.Element {
  const [pending, setPending] = useState(false);

  async function onClick() {
    const today = todayIso();
    const from = dateFilter || isoDaysAgo(30);
    const to = dateFilter || today;

    const input: ExportRidesInput = {
      from,
      to,
      status: statusFilter !== 'all' ? (statusFilter as ExportRidesInput['status']) : undefined,
      transportMode:
        modeFilter !== 'all' ? (modeFilter as ExportRidesInput['transportMode']) : undefined,
    };

    setPending(true);
    const res = await exportRidesCsvAction(input);
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
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void onClick()}
      disabled={pending}
      className="gap-8"
      title={
        dateFilter
          ? `Exporter les courses du ${dateFilter}`
          : 'Exporter les courses des 30 derniers jours'
      }
    >
      <Download className="h-12 w-12" aria-hidden />
      {pending ? 'Export…' : 'Exporter CSV'}
    </Button>
  );
}
