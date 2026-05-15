'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import type {
  CaisseRow,
  CaisseSortColumn,
  CaisseSortDir,
} from '../_lib/queries-caisse';

/**
 * CaisseTable — tableau dense Surface C Phase 04.7.
 *
 * 5 colonnes : Date, Patient, Chauffeur, Mode paiement (badge), Tarif (€).
 * Tri par colonne avec aria-sort + URL params (deep-link friendly).
 * Empty state Wallet centré si 0 rides.
 * Tfoot total bold tabular-nums right-aligned.
 *
 * Refs : UI-SPEC Surface C, R1 contraste WCAG AA, R2 a11y tri keyboard.
 */

interface Props {
  rows: CaisseRow[];
  sort: CaisseSortColumn;
  dir: CaisseSortDir;
  date: string;
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  cb: 'CB',
  cheque: 'Chèque',
  cgss_differe: 'CGSS différé',
};

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PaymentBadge({ method }: { method: string | null }): JSX.Element {
  const label = METHOD_LABELS[method ?? ''] ?? '—';
  if (method === 'cash')
    return <Badge variant="outline">{label}</Badge>;
  if (method === 'cb')
    return (
      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
        {label}
      </Badge>
    );
  if (method === 'cheque')
    return (
      <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
        {label}
      </Badge>
    );
  if (method === 'cgss_differe')
    return (
      <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">
        {label}
      </Badge>
    );
  return <Badge variant="outline">{label}</Badge>;
}

function SortHeader({
  column,
  label,
  currentSort,
  currentDir,
  date,
  className,
}: {
  column: CaisseSortColumn;
  label: string;
  currentSort: CaisseSortColumn;
  currentDir: CaisseSortDir;
  date: string;
  className?: string;
}): JSX.Element {
  const isActive = currentSort === column;
  const nextDir: CaisseSortDir = isActive && currentDir === 'desc' ? 'asc' : 'desc';
  const ariaSort = isActive
    ? currentDir === 'asc'
      ? ('ascending' as const)
      : ('descending' as const)
    : ('none' as const);
  const Icon = isActive
    ? currentDir === 'asc'
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={cn(
        'text-left text-xs font-medium uppercase tracking-wide text-muted-foreground',
        'px-12 py-8',
        className,
      )}
    >
      <Link
        href={{
          pathname: '/courses/caisse',
          query: { date, sort: column, dir: nextDir },
        }}
        scroll={false}
        className="inline-flex items-center gap-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
      >
        {label}
        <Icon className="h-12 w-12" aria-hidden />
      </Link>
    </th>
  );
}

export function CaisseTable({
  rows,
  sort,
  dir,
  date,
}: Props): JSX.Element {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-border py-48 text-center">
        <Wallet className="h-32 w-32 text-muted-foreground mb-12" aria-hidden />
        <p className="text-sm font-medium">Aucun encaissement ce jour.</p>
        <p className="mt-8 max-w-[320px] text-xs text-muted-foreground">
          Les courses apparaissent ici dès qu'elles sont clôturées et
          encaissées par un chauffeur.
        </p>
      </div>
    );
  }

  const total = rows.reduce(
    (acc, r) => acc + Number(r.tarif_amount_eur ?? 0),
    0,
  );

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full divide-y divide-border">
        <thead className="bg-muted/40">
          <tr>
            <SortHeader
              column="date"
              label="Date"
              currentSort={sort}
              currentDir={dir}
              date={date}
              className="w-[140px]"
            />
            <th
              scope="col"
              className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground px-12 py-8"
            >
              Patient
            </th>
            <th
              scope="col"
              className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground px-12 py-8 w-[200px]"
            >
              Chauffeur
            </th>
            <th
              scope="col"
              className="text-left text-xs font-medium uppercase tracking-wide text-muted-foreground px-12 py-8 w-[140px]"
            >
              Mode paiement
            </th>
            <SortHeader
              column="tarif"
              label="Tarif"
              currentSort={sort}
              currentDir={dir}
              date={date}
              className="w-[120px] text-right"
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/40 transition-colors">
              <td className="px-12 py-12 text-sm tabular-nums">
                {formatDateTime(r.ended_at ?? r.scheduled_at)}
              </td>
              <td className="px-12 py-12 text-sm">
                {`${r.patient_nom} ${r.patient_prenom}`.trim() || '—'}
              </td>
              <td className="px-12 py-12 text-sm">
                {r.driver_nom ? (
                  <div className="flex items-center gap-8">
                    <InitialsAvatar
                      name={r.driver_nom}
                      role="chauffeur"
                      size={24}
                    />
                    <span className="truncate">{r.driver_nom}</span>
                  </div>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-12 py-12">
                <PaymentBadge method={r.payment_method} />
              </td>
              <td className="px-12 py-12 text-sm font-mono tabular-nums text-right">
                {formatEur(Number(r.tarif_amount_eur ?? 0))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-muted/40">
          <tr>
            <td
              colSpan={4}
              className="px-12 py-12 text-right text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Total
            </td>
            <td className="px-12 py-12 text-right text-sm font-mono tabular-nums font-semibold">
              {formatEur(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
