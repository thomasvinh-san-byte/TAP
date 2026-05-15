'use client';

import * as React from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import type { PricingResult } from '@tap/pricing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * PricingBreakdown — Surface A UI-SPEC Phase 04.7.
 *
 * Affiche le détail du tarif calculé par `computeCgssShortTrip` (stub
 * DEC-042) avec badge « DEMO » obligatoire et bouton « Modifier » optionnel.
 *
 * - editable=false → vue read-only (chauffeur dans end-ride-modal)
 * - editable=true → vue avec bouton Modifier (régulateur dans ride-drawer
 *   post-clôture, ouvre OverrideTarifModal Surface B)
 *
 * Si pricing.source === 'fallback_random' : bandeau warning R3 héritage
 * Phase 04.5 (bg-warning/10 + border-warning/30 + text-foreground).
 *
 * Refs : DEC-042, UI-SPEC Surface A, UI-PATTERNS DEC-034.
 */

interface Props {
  pricing: PricingResult;
  editable?: boolean;
  onOverride?: () => void;
}

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatKm(n: number | null): string {
  if (n === null) return '—';
  return `${n.toFixed(1).replace('.', ',')} km`;
}

export function PricingBreakdown({
  pricing,
  editable,
  onOverride,
}: Props): JSX.Element {
  const isFallback = pricing.source === 'fallback_random';

  return (
    <div
      className="rounded-md border border-border bg-muted/20 p-16 space-y-12"
      data-testid="pricing-breakdown"
    >
      {isFallback && (
        <div
          role="status"
          className="flex items-start gap-8 rounded-md border border-warning/30 bg-warning/10 px-12 py-8"
        >
          <AlertTriangle
            className="h-16 w-16 shrink-0 text-warning mt-2"
            aria-hidden
          />
          <p className="text-xs text-foreground">
            Distance non calculable. Tarif estimé.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Détail tarif</h3>
        <span
          aria-label="Tarif démonstration non contractuel"
          className="shrink-0 rounded-md bg-muted px-8 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        >
          DEMO
        </span>
      </div>

      <dl className="space-y-6 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Forfait prise en charge</dt>
          <dd className="font-mono tabular-nums">
            {formatEur(pricing.forfait_eur)}
          </dd>
        </div>

        {!isFallback && pricing.distance_km !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Distance {formatKm(pricing.distance_km)} ×{' '}
              {pricing.prix_km_eur !== null
                ? formatEur(pricing.prix_km_eur)
                : '—'}
            </dt>
            <dd className="font-mono tabular-nums">
              {pricing.km_total_eur !== null
                ? formatEur(pricing.km_total_eur)
                : '—'}
            </dd>
          </div>
        )}

        {isFallback && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Estimation</dt>
            <dd className="font-mono tabular-nums">
              {formatEur(
                pricing.total_eur -
                  pricing.forfait_eur -
                  pricing.supp_tpmr_eur -
                  pricing.majo_nuit_eur,
              )}
            </dd>
          </div>
        )}

        {pricing.supp_tpmr_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément TPMR</dt>
            <dd className="font-mono tabular-nums">
              +{formatEur(pricing.supp_tpmr_eur)}
            </dd>
          </div>
        )}

        {pricing.majo_nuit_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Majoration nuit (+{pricing.majo_nuit_pct}%)
            </dt>
            <dd className="font-mono tabular-nums">
              +{formatEur(pricing.majo_nuit_eur)}
            </dd>
          </div>
        )}
      </dl>

      <div
        className={cn(
          'flex items-center justify-between border-t border-border pt-12',
          'text-base font-semibold',
        )}
      >
        <span>Total</span>
        <div className="flex items-center gap-12">
          <span className="font-mono tabular-nums">
            {formatEur(pricing.total_eur)}
          </span>
          {editable && onOverride && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOverride}
              className="gap-4"
            >
              <Pencil className="h-12 w-12" aria-hidden />
              Modifier
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
