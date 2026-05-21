'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { recomputeTarifsAction } from '../actions';

/**
 * Bouton one-shot dirigeant — recalcul rétroactif des tarifs CGSS
 * (Phase 05.5 Wave 4, DEC-060). Recalcule les courses tarifées auto
 * non encaissées avec la grille active. Préserve les tarifs saisis
 * manuellement et les courses déjà encaissées.
 *
 * Refs : DEC-060, PLAN-4, modèle BackfillGeocoding.
 */
export function RecomputeTarifs(): JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    recomputed: number;
    candidates: number;
  } | null>(null);

  const run = async (): Promise<void> => {
    if (
      !window.confirm(
        'Recalculer les tarifs des courses calculées automatiquement et non encaissées ?',
      )
    ) {
      return;
    }
    setPending(true);
    setResult(null);
    const res = await recomputeTarifsAction();
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResult({ recomputed: res.recomputed, candidates: res.candidates });
    toast.success(`Recalcul terminé : ${res.recomputed} course(s) recalculée(s).`);
  };

  return (
    <div className="space-y-12">
      <Button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        variant="outline"
        className="gap-8"
      >
        <Calculator className={pending ? 'h-16 w-16 animate-spin' : 'h-16 w-16'} aria-hidden />
        {pending ? 'Recalcul…' : 'Recalculer les tarifs'}
      </Button>

      {result && (
        <dl className="border-border bg-muted/20 space-y-4 rounded-md border p-12 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Courses recalculées</dt>
            <dd className="font-mono tabular-nums">{result.recomputed}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Courses candidates</dt>
            <dd className="font-mono tabular-nums">{result.candidates}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
