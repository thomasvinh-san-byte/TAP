'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { backfillRideGeocodingAction } from '../actions';

/**
 * Bouton one-shot dirigeant pour re-géocoder les courses créées avant la
 * migration géocoding Phase 04.7. Affiche résumé final (processed/skipped/
 * errors) post-action. Pas de progressbar streaming V1.5.
 *
 * Refs : PLAN-3 T3.3, DEC-044, DEC-032 (Server Action tracée).
 */
export function BackfillGeocoding(): JSX.Element {
  const [pending, setPending] = React.useState(false);
  const [result, setResult] = React.useState<{
    processed: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const run = async () => {
    setPending(true);
    setResult(null);
    toast.info('Re-géocodage en cours… cela peut prendre plusieurs minutes.');
    const res = await backfillRideGeocodingAction();
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResult({
      processed: res.processed,
      skipped: res.skipped,
      errors: res.errors,
    });
    toast.success(
      `Re-géocodage terminé : ${res.processed} traités, ${res.skipped} ignorés, ${res.errors} erreurs.`,
    );
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
        <RefreshCw
          className={pending ? 'h-16 w-16 animate-spin' : 'h-16 w-16'}
          aria-hidden
        />
        {pending ? 'Re-géocodage…' : 'Re-géocoder courses sans coordonnées'}
      </Button>

      {result && (
        <dl className="rounded-md border border-border bg-muted/20 p-12 text-sm space-y-4">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Courses traitées</dt>
            <dd className="font-mono tabular-nums">{result.processed}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Ignorées (pas de match BAN)</dt>
            <dd className="font-mono tabular-nums">{result.skipped}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Erreurs</dt>
            <dd
              className={
                result.errors > 0
                  ? 'font-mono tabular-nums text-destructive'
                  : 'font-mono tabular-nums'
              }
            >
              {result.errors}
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
