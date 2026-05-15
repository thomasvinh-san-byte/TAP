'use client';

import type { CaisseTotals } from '../_lib/queries-caisse';

/**
 * CaisseSummary — sub-header total jour + 4 sous-totaux par mode paiement.
 *
 * Layout dense conforme UI-PATTERNS DEC-034 (grille 4 cols, tabular-nums,
 * border + bg-muted/20 discret).
 */

interface Props {
  totals: CaisseTotals;
}

const METHOD_ORDER = ['cash', 'cb', 'cheque', 'cgss_differe'] as const;
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cb: 'CB',
  cheque: 'Chèque',
  cgss_differe: 'CGSS différé',
};

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

export function CaisseSummary({ totals }: Props): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-16 space-y-12">
      <div className="flex items-baseline gap-12">
        <span className="text-2xl font-semibold tabular-nums">
          {formatEur(totals.total_eur)}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {totals.count} course{totals.count > 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-12 sm:grid-cols-4">
        {METHOD_ORDER.map((m) => (
          <div key={m} className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {METHOD_LABELS[m]}
            </div>
            <div className="text-sm font-mono tabular-nums">
              {formatEur(totals.by_method[m] ?? 0)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
