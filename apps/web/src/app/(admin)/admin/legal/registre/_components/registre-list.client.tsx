'use client';

import { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { RegistreDrawer } from './registre-drawer.client';

type Entry = {
  id: string;
  purpose: string;
  legal_basis: string;
  retention_period_days: number;
  international_transfer: boolean;
  created_at: string;
};

const COLUMNS: DataTableColumn<Entry>[] = [
  { key: 'purpose', header: 'Finalité', cell: (e) => e.purpose },
  {
    key: 'legal_basis',
    header: 'Base légale',
    cell: (e) => <Badge variant="outline">{e.legal_basis}</Badge>,
  },
  {
    key: 'retention',
    header: 'Conservation',
    cell: (e) => <span className="tabular-nums">{e.retention_period_days} jours</span>,
  },
  {
    key: 'international_transfer',
    header: 'Transfert intl.',
    cell: (e) => (e.international_transfer ? 'Oui' : 'Non'),
  },
  {
    key: 'created_at',
    header: 'Créé le',
    cell: (e) => (
      <span className="text-muted-foreground tabular-nums">
        {new Date(e.created_at).toLocaleDateString('fr-FR')}
      </span>
    ),
  },
];

/**
 * Liste registre des traitements + ouverture drawer création.
 * D-05 (Phase 06.6) : versioning par lignes — chaque ligne est une version
 * archivée.
 */
export function RegistreList({ entries }: { entries: Entry[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (entries.length === 0) {
    return (
      <>
        <EmptyState
          icon={BookOpen}
          title="Registre vide"
          description="Pré-remplissez votre registre RGPD avec les traitements détectés automatiquement : à relire et adapter."
          action={{
            href: '/admin/legal/registre/pre-remplir',
            label: 'Pré-remplir',
          }}
          secondaryAction={{
            onClick: () => setDrawerOpen(true),
            label: 'Créer une entrée manuellement',
            icon: Plus,
          }}
        />
        <RegistreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </>
    );
  }

  return (
    <>
      <DataTable
        columns={COLUMNS}
        rows={entries}
        rowKey={(e) => e.id}
        ariaLabel="Registre des traitements RGPD"
      />
      <RegistreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
