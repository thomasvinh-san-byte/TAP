'use client';

import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, ListMeta, Pagination, type DataTableColumn } from '@/components/data-table';
import { DpaDrawer } from './dpa-drawer.client';

const PAGE_SIZE = 25;

type Entry = {
  id: string;
  subprocessor_name: string;
  subprocessor_role: string;
  dpa_version: string;
  signed_at: string;
  expires_at: string | null;
};

const COLUMNS: DataTableColumn<Entry>[] = [
  {
    key: 'subprocessor_name',
    header: 'Sous-traitant',
    cell: (e) => <span className="font-medium">{e.subprocessor_name}</span>,
  },
  { key: 'subprocessor_role', header: 'Rôle', cell: (e) => e.subprocessor_role },
  {
    key: 'dpa_version',
    header: 'Version',
    cell: (e) => <span className="tabular-nums">{e.dpa_version}</span>,
  },
  {
    key: 'signed_at',
    header: 'Signé le',
    cell: (e) => (
      <span className="tabular-nums">{new Date(e.signed_at).toLocaleDateString('fr-FR')}</span>
    ),
  },
  {
    key: 'expires_at',
    header: 'Expire le',
    cell: (e) => (
      <span className="text-muted-foreground tabular-nums">
        {e.expires_at ? new Date(e.expires_at).toLocaleDateString('fr-FR') : 'Évergreen'}
      </span>
    ),
  },
];

export function DpaList({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const paged = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouveau DPA
        </Button>
      </div>

      {entries.length > 0 && (
        <ListMeta>
          {entries.length} contrat{entries.length > 1 ? 's' : ''} sous-traitant
        </ListMeta>
      )}

      <DataTable
        columns={COLUMNS}
        rows={paged}
        rowKey={(e) => e.id}
        ariaLabel="Liste des accords sous-traitant DPA"
        emptyState={
          <EmptyState
            icon={FileText}
            title="Aucun DPA enregistré"
            description="Pré-remplissez vos accords sous-traitant pour les services tiers détectés."
            action={{
              href: '/admin/legal/dpa/pre-remplir',
              label: 'Pré-remplir',
            }}
          />
        }
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={entries.length} onPageChange={setPage} />

      <DpaDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
