'use client';

import * as React from 'react';
import { AlertTriangle, Pencil } from 'lucide-react';
import type { MajorationMotif, PricingResult } from '@tap/pricing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * PricingBreakdown — Surface A.
 *
 * Phase 05.5 Wave 1 : adaptation à la `PricingResult` enrichie (DEC-061 —
 * forfait / km facturés / DROM / TPMR / majoration). Le retrait du badge
 * « DEMO » et le disclaimer estimatif fin sont traités en Wave 2
 * (affichage complet UI-SPEC Surface A). Cette wave assure typecheck +
 * build verts.
 *
 * - editable=false → vue read-only (chauffeur dans end-ride-modal)
 * - editable=true → vue avec bouton Modifier (régulateur post-clôture)
 *
 * Refs : DEC-061, UI-SPEC Surface A.
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

const MAJORATION_LABEL: Record<Exclude<MajorationMotif, null>, string> = {
  nuit: 'Majoration nuit',
  weekend: 'Majoration week-end',
  ferie: 'Majoration jour férié',
};

export function PricingBreakdown({
  pricing,
  editable,
  onOverride,
}: Props): JSX.Element {
  const distanceUnavailable = pricing.distance_method === 'unavailable';

  return (
    <div
      className="rounded-md border border-border bg-muted/20 p-16 space-y-12"
      data-testid="pricing-breakdown"
    >
      {distanceUnavailable && (
        <div
          role="status"
          className="flex items-start gap-8 rounded-md border border-warning/30 bg-warning/10 px-12 py-8"
        >
          <AlertTriangle
            className="h-16 w-16 shrink-0 text-warning mt-2"
            aria-hidden
          />
          <p className="text-xs text-foreground">
            Distance non disponible — forfait et suppléments seuls.
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

        {!distanceUnavailable && pricing.distance_km !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Distance {formatKm(pricing.distance_km)} ·{' '}
              {formatKm(pricing.km_factures)} facturés ×{' '}
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

        {pricing.supplement_drom_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément DROM</dt>
            <dd className="font-mono tabular-nums">
              +{formatEur(pricing.supplement_drom_eur)}
            </dd>
          </div>
        )}

        {pricing.supplement_tpmr_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément TPMR</dt>
            <dd className="font-mono tabular-nums">
              +{formatEur(pricing.supplement_tpmr_eur)}
            </dd>
          </div>
        )}

        {pricing.majoration_eur > 0 && pricing.majoration_motif !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {MAJORATION_LABEL[pricing.majoration_motif]} (+
              {pricing.majoration_pct}%)
            </dt>
            <dd className="font-mono tabular-nums">
              +{formatEur(pricing.majoration_eur)}
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
