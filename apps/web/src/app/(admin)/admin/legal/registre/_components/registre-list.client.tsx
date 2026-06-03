'use client';

import { useState } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RegistreDrawer } from './registre-drawer.client';

type Entry = {
  id: string;
  purpose: string;
  legal_basis: string;
  retention_period_days: number;
  international_transfer: boolean;
  created_at: string;
};

/**
 * Liste registre des traitements + ouverture drawer création.
 * D-05 : versioning par lignes — chaque ligne est une version archivée.
 */
export function RegistreList({ entries }: { entries: Entry[] }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (entries.length === 0) {
    return (
      <>
        <EmptyState
          icon={BookOpen}
          title="Registre vide"
          description="Pré-remplissez votre registre RGPD avec les traitements détectés automatiquement — à relire et adapter."
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
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b">
            <tr>
              <th className="p-12 text-left font-medium">Finalité</th>
              <th className="p-12 text-left font-medium">Base légale</th>
              <th className="p-12 text-left font-medium">Conservation</th>
              <th className="p-12 text-left font-medium">Transfert intl.</th>
              <th className="p-12 text-left font-medium">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="hover:bg-muted/20 border-b last:border-0">
                <td className="p-12">{e.purpose}</td>
                <td className="p-12">
                  <Badge variant="outline">{e.legal_basis}</Badge>
                </td>
                <td className="p-12 tabular-nums">{e.retention_period_days} jours</td>
                <td className="p-12">{e.international_transfer ? 'Oui' : 'Non'}</td>
                <td className="text-muted-foreground p-12 tabular-nums">
                  {new Date(e.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RegistreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
