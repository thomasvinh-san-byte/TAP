'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportStatsCsvAction } from '../_lib/export-stats';

/**
 * Bouton « Exporter statistiques (CSV) » du tableau de bord (Phase 06.37
 * §5.23, DEC-116). Sections agrégées (volume, incidents, chauffeurs,
 * CA + comparatif N-1) extraites de `queries-dashboard` — 0 duplication
 * d'agrégat.
 */
export function ExportStatsButton(): JSX.Element {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    const res = await exportStatsCsvAction();
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
    >
      <Download className="h-12 w-12" aria-hidden />
      {pending ? 'Export…' : 'Exporter les statistiques'}
    </Button>
  );
}
