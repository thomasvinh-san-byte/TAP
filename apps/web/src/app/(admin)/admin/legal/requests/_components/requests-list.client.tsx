'use client';

import { useState } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, ListMeta, Pagination, type DataTableColumn } from '@/components/data-table';
import { RequestDrawer } from './request-drawer.client';

const PAGE_SIZE = 25;

type Entry = {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  deadline_at: string;
  requester_email: string | null;
  response_at: string | null;
};

const COLUMNS: DataTableColumn<Entry>[] = [
  {
    key: 'request_type',
    header: 'Type',
    cell: (e) => <Badge variant="outline">{e.request_type}</Badge>,
  },
  { key: 'status', header: 'Statut', cell: (e) => e.status },
  {
    key: 'requested_at',
    header: 'Reçue le',
    cell: (e) => (
      <span className="tabular-nums">{new Date(e.requested_at).toLocaleDateString('fr-FR')}</span>
    ),
  },
  {
    key: 'deadline_at',
    header: 'Échéance',
    cell: (e) => (
      <span className="tabular-nums">{new Date(e.deadline_at).toLocaleDateString('fr-FR')}</span>
    ),
  },
  {
    key: 'requester_email',
    header: 'Demandeur',
    cell: (e) => <span className="text-muted-foreground">{e.requester_email ?? '—'}</span>,
  },
  {
    key: 'response_at',
    header: 'Répondue le',
    cell: (e) => (
      <span className="text-muted-foreground tabular-nums">
        {e.response_at ? new Date(e.response_at).toLocaleDateString('fr-FR') : '—'}
      </span>
    ),
  },
];

export function RequestsList({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const paged = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="flex justify-end">
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvelle demande
        </Button>
      </div>

      {entries.length > 0 && (
        <ListMeta>
          {entries.length} demande{entries.length > 1 ? 's' : ''} RGPD
        </ListMeta>
      )}

      <DataTable
        columns={COLUMNS}
        rows={paged}
        rowKey={(e) => `${e.id}:${e.status}`}
        ariaLabel="Liste des demandes de droits patients"
        emptyState={
          <EmptyState
            icon={Inbox}
            title="Aucune demande en attente"
            description="Aucune demande de droits patients reçue. Vous disposez de 30 jours pour répondre à chaque demande."
          />
        }
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={entries.length} onPageChange={setPage} />

      <RequestDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
