'use client';

import { useState } from 'react';
import { DataTable, ListMeta, Pagination, type DataTableColumn } from '@/components/data-table';
import type { TariffGridRow } from '../page';

const PAGE_SIZE = 25;

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface Row extends TariffGridRow {
  isActive: boolean;
}

const COLUMNS: DataTableColumn<Row>[] = [
  {
    key: 'date_effet',
    header: "Date d'effet",
    cell: (g) => <span className="tabular-nums">{formatDateFr(g.date_effet)}</span>,
  },
  {
    key: 'forfait',
    header: 'Forfait',
    cell: (g) => <span className="font-mono tabular-nums">{formatEur(g.forfait_eur)}</span>,
  },
  {
    key: 'prix_km',
    header: 'Km 974',
    cell: (g) => <span className="font-mono tabular-nums">{formatEur(g.prix_km_eur)}</span>,
  },
  {
    key: 'supplement_drom',
    header: 'DROM',
    cell: (g) => <span className="font-mono tabular-nums">{formatEur(g.supplement_drom_eur)}</span>,
  },
  {
    key: 'supplement_tpmr',
    header: 'TPMR',
    cell: (g) => <span className="font-mono tabular-nums">{formatEur(g.supplement_tpmr_eur)}</span>,
  },
  {
    key: 'majoration_pct',
    header: 'Majo',
    cell: (g) => <span className="font-mono tabular-nums">{g.majoration_pct} %</span>,
  },
  {
    key: 'statut',
    header: 'Statut',
    cell: (g) =>
      g.isActive ? (
        <span className="text-success text-xs font-semibold">Active</span>
      ) : (
        <span className="text-muted-foreground text-xs">Archivée</span>
      ),
  },
];

export function TariffHistoryTable({
  grids,
  activeId,
}: {
  grids: TariffGridRow[];
  activeId: string;
}): JSX.Element {
  const rows: Row[] = grids.map((g) => ({ ...g, isActive: g.id === activeId }));
  const [page, setPage] = useState(0);
  const paged = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="space-y-12">
      <h2 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
        Historique des grilles
      </h2>
      {rows.length > 0 && (
        <ListMeta>
          {rows.length} grille{rows.length > 1 ? 's' : ''}
        </ListMeta>
      )}
      <DataTable
        columns={COLUMNS}
        rows={paged}
        rowKey={(g) => `${g.id}:${g.isActive ? 'active' : 'archived'}`}
        ariaLabel="Historique des grilles tarifaires CGSS"
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} />
    </section>
  );
}
