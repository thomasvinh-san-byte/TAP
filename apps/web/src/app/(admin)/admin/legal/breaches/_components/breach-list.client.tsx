'use client';

import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, ListMeta, Pagination, type DataTableColumn } from '@/components/data-table';
import { BreachTimer } from './breach-timer.client';
import { BreachDrawer } from './breach-drawer.client';

const PAGE_SIZE = 25;

type Entry = {
  id: string;
  detected_at: string;
  severity: string;
  nature: string;
  description: string;
  cnil_notification_required: boolean;
  cnil_notification_at: string | null;
  closed_at: string | null;
};

const COLUMNS: DataTableColumn<Entry>[] = [
  {
    key: 'detected_at',
    header: 'Détecté le',
    cell: (e) => (
      <span className="tabular-nums">{new Date(e.detected_at).toLocaleString('fr-FR')}</span>
    ),
  },
  {
    key: 'severity',
    header: 'Gravité',
    cell: (e) => <Badge variant="outline">{e.severity}</Badge>,
  },
  { key: 'nature', header: 'Nature', cell: (e) => e.nature },
  {
    key: 'description',
    header: 'Description',
    cell: (e) => <span className="block max-w-[300px] truncate">{e.description}</span>,
  },
  {
    key: 'cnil_delay',
    header: 'Délai CNIL',
    cell: (e) =>
      e.cnil_notification_required && !e.cnil_notification_at && !e.closed_at ? (
        <BreachTimer detectedAt={e.detected_at} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: 'state',
    header: 'État',
    cell: (e) => (e.closed_at ? <Badge>Clôturé</Badge> : <Badge variant="outline">Ouvert</Badge>),
  },
];

export function BreachList({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const paged = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvel incident
        </Button>
      </div>

      {entries.length > 0 && (
        <ListMeta>
          {entries.length} violation{entries.length > 1 ? 's' : ''} de données
        </ListMeta>
      )}

      <DataTable
        columns={COLUMNS}
        rows={paged}
        rowKey={(e) => `${e.id}:${e.closed_at ?? 'open'}`}
        ariaLabel="Liste des incidents de sécurité enregistrés"
        emptyState={
          <EmptyState
            icon={ShieldCheck}
            title="Aucun incident enregistré"
            description="Aucune violation de données déclarée. En cas d'incident, déclarez-le ici : vous avez 72 h pour notifier la CNIL, un compte à rebours vous accompagne."
          />
        }
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={entries.length} onPageChange={setPage} />

      <BreachDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
