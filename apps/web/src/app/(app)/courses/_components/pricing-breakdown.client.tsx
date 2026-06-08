'use client';

import * as React from 'react';
import { AlertTriangle, Info, Pencil } from 'lucide-react';
import type { MajorationMotif, PricingResult } from '@tap/pricing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * PricingBreakdown — Surface A.
 *
 * Décomposition réelle du tarif CGSS (DEC-061) : forfait + distance/km
 * facturés + supplément DROM + supplément TPMR + majoration (label
 * dynamique nuit/week-end/jour férié) + total. Disclaimer estimatif en
 * pied — le tarif n'est pas contractuel jusqu'à la facturation CGSS
 * (Phase 06). Aucun badge de démonstration — le calcul est réel.
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

export function PricingBreakdown({ pricing, editable, onOverride }: Props): JSX.Element {
  const distanceUnavailable = pricing.distance_method === 'unavailable';

  return (
    <div
      className="border-border bg-muted/20 space-y-12 rounded-md border p-16"
      data-testid="pricing-breakdown"
    >
      {distanceUnavailable && (
        <div
          role="status"
          className="border-warning/30 bg-warning/10 flex items-start gap-8 rounded-md border px-12 py-8"
        >
          <AlertTriangle className="text-warning mt-2 h-16 w-16 shrink-0" aria-hidden />
          <p className="text-foreground text-xs">
            Distance non disponible : forfait et suppléments seuls.
          </p>
        </div>
      )}

      <h3 className="text-sm font-semibold">Détail tarif</h3>

      <dl className="space-y-6 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Forfait prise en charge</dt>
          <dd className="font-mono tabular-nums">{formatEur(pricing.forfait_eur)}</dd>
        </div>

        {!distanceUnavailable && pricing.distance_km !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              Distance {formatKm(pricing.distance_km)} · {formatKm(pricing.km_factures)} facturés ×{' '}
              {pricing.prix_km_eur !== null ? formatEur(pricing.prix_km_eur) : '—'}
            </dt>
            <dd className="font-mono tabular-nums">
              {pricing.km_total_eur !== null ? formatEur(pricing.km_total_eur) : '—'}
            </dd>
          </div>
        )}

        {pricing.supplement_drom_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément DROM</dt>
            <dd className="font-mono tabular-nums">+{formatEur(pricing.supplement_drom_eur)}</dd>
          </div>
        )}

        {pricing.supplement_tpmr_eur > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Supplément TPMR</dt>
            <dd className="font-mono tabular-nums">+{formatEur(pricing.supplement_tpmr_eur)}</dd>
          </div>
        )}

        {pricing.majoration_eur > 0 && pricing.majoration_motif !== null && (
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">
              {MAJORATION_LABEL[pricing.majoration_motif]} (+
              {pricing.majoration_pct}%)
            </dt>
            <dd className="font-mono tabular-nums">+{formatEur(pricing.majoration_eur)}</dd>
          </div>
        )}
      </dl>

      <div
        className={cn(
          'border-border flex items-center justify-between border-t pt-12',
          'text-base font-semibold',
        )}
      >
        <span>Total</span>
        <div className="flex items-center gap-12">
          <span className="font-mono tabular-nums">{formatEur(pricing.total_eur)}</span>
          {editable && onOverride && (
            <Button type="button" variant="ghost" size="sm" onClick={onOverride} className="gap-4">
              <Pencil className="h-12 w-12" aria-hidden />
              Modifier
            </Button>
          )}
        </div>
      </div>

      <p className="text-muted-foreground flex items-start gap-8 text-xs">
        <Info className="mt-2 h-12 w-12 shrink-0" aria-hidden />
        <span>
          Tarif estimatif, non contractuel jusqu&apos;à la facturation CGSS. Distance estimée (vol
          d&apos;oiseau corrigé).
        </span>
      </p>
    </div>
  );
}
