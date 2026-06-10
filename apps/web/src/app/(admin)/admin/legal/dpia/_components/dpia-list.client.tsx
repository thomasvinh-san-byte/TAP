'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, ListMeta, Pagination, type DataTableColumn } from '@/components/data-table';
import { DpiaForm } from './dpia-form.client';

const PAGE_SIZE = 25;

type Entry = {
  id: string;
  title: string;
  status: string;
  residual_risk_level: string | null;
  reviewed_at: string;
  next_review_at: string;
};

export function DpiaList({ entries }: { entries: Entry[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const paged = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: DataTableColumn<Entry>[] = [
    {
      key: 'title',
      header: 'Titre',
      cell: (e) => <span className="font-medium">{e.title}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (e) => (
        <Badge variant={e.status === 'validee' ? 'default' : 'outline'}>{e.status}</Badge>
      ),
    },
    {
      key: 'residual_risk_level',
      header: 'Risque résiduel',
      cell: (e) => e.residual_risk_level ?? '—',
    },
    {
      key: 'reviewed_at',
      header: 'Revue le',
      cell: (e) => (
        <span className="tabular-nums">{new Date(e.reviewed_at).toLocaleDateString('fr-FR')}</span>
      ),
    },
    {
      key: 'next_review_at',
      header: 'Prochaine',
      cell: (e) => (
        <span className="tabular-nums">
          {new Date(e.next_review_at).toLocaleDateString('fr-FR')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (e) => (
        <Button variant="outline" size="sm" onClick={() => setEditing(e.id)}>
          Modifier
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvelle DPIA
        </Button>
      </div>

      {entries.length > 0 && (
        <ListMeta>
          {entries.length} analyse{entries.length > 1 ? 's' : ''} d&apos;impact
        </ListMeta>
      )}

      <DataTable
        columns={columns}
        rows={paged}
        rowKey={(e) => `${e.id}:${e.status}`}
        ariaLabel="Liste des analyses d'impact DPIA"
        emptyState={
          <div className="rounded-lg border border-dashed p-48 text-center">
            <ClipboardCheck className="text-muted-foreground mx-auto h-32 w-32" aria-hidden />
            <p className="text-foreground mt-16 font-medium">Aucune analyse d&apos;impact.</p>
            <p className="text-muted-foreground mx-auto mt-8 max-w-md text-sm">
              TAP peut créer une trame d&apos;analyse d&apos;impact pour le transport de données de
              santé : la structure, à compléter par vos soins.
            </p>
            <Button asChild variant="accent" className="mt-24">
              <Link href="/admin/legal/dpia/pre-remplir">Créer une trame DPIA</Link>
            </Button>
          </div>
        }
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={entries.length} onPageChange={setPage} />

      {creating && <DpiaForm mode="create" onClose={() => setCreating(false)} />}
      {editing && <DpiaForm mode="edit" dpiaId={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
