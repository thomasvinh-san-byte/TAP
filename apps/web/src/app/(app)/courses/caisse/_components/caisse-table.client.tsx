'use client';

import * as React from 'react';
import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/data-table';
import type { CaisseRow, CaisseSortColumn, CaisseSortDir } from '../_lib/queries-caisse';

/**
 * CaisseTable — tableau dense Surface C Phase 04.7, migré sur `<DataTable>`
 * en Phase 06.15. Le tri par URL (deep-link, `aria-sort`) est généralisé
 * via la prop `sort.hrefFor` de `<DataTable>`.
 *
 * 5 colonnes : Date, Patient, Chauffeur, Mode paiement (badge), Tarif (€).
 * Tfoot total bold tabular-nums right-aligned préservé.
 *
 * Refs : UI-SPEC Surface C, R1 contraste WCAG AA, R2 a11y tri keyboard,
 * Phase 06.15 D-03 (tri généralisé).
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
  if (method === 'cash') return <Badge variant="outline">{label}</Badge>;
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

const COLUMNS: DataTableColumn<CaisseRow>[] = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    width: '140px',
    cell: (r) => (
      <span className="tabular-nums">{formatDateTime(r.ended_at ?? r.scheduled_at)}</span>
    ),
  },
  {
    key: 'patient',
    header: 'Patient',
    cell: (r) => `${r.patient_nom} ${r.patient_prenom}`.trim() || '—',
  },
  {
    key: 'driver',
    header: 'Chauffeur',
    width: '200px',
    cell: (r) =>
      r.driver_nom ? (
        <div className="flex items-center gap-8">
          <InitialsAvatar name={r.driver_nom} role="chauffeur" size={24} />
          <span className="truncate">{r.driver_nom}</span>
        </div>
      ) : (
        '—'
      ),
  },
  {
    key: 'method',
    header: 'Mode paiement',
    width: '140px',
    cell: (r) => <PaymentBadge method={r.payment_method} />,
  },
  {
    key: 'tarif',
    header: 'Tarif',
    sortable: true,
    width: '120px',
    align: 'right',
    cell: (r) => (
      <span className="font-mono tabular-nums">{formatEur(Number(r.tarif_amount_eur ?? 0))}</span>
    ),
  },
];

export function CaisseTable({ rows, sort, dir, date }: Props): JSX.Element {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Caisse à jour"
        description="Toutes les courses encaissables ont été traitées pour cette date."
      />
    );
  }

  const total = rows.reduce((acc, r) => acc + Number(r.tarif_amount_eur ?? 0), 0);

  const sortConfig: DataTableSort = {
    column: sort,
    dir,
    hrefFor: (column, nextDir) =>
      `/courses/caisse?${new URLSearchParams({ date, sort: column, dir: nextDir }).toString()}`,
  };

  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      ariaLabel="Encaissements du jour"
      sort={sortConfig}
      footer={
        <tr>
          <td
            colSpan={4}
            className="text-muted-foreground px-12 py-12 text-right text-sm font-semibold uppercase tracking-wide"
          >
            Total
          </td>
          <td className="px-12 py-12 text-right font-mono text-sm font-semibold tabular-nums">
            {formatEur(total)}
          </td>
        </tr>
      }
    />
  );
}
