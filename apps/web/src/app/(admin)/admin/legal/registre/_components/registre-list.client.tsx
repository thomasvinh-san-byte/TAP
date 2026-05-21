'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <div className="rounded-lg border border-dashed p-48 text-center">
        <p className="text-muted-foreground">Aucune entrée au registre pour le moment.</p>
        <Button className="mt-16" onClick={() => setDrawerOpen(true)}>
          Créer la première entrée
        </Button>
        <RegistreDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      </div>
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
