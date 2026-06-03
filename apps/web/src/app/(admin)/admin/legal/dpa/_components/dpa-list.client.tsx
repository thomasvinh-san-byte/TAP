'use client';

import { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { DpaDrawer } from './dpa-drawer.client';

type Entry = {
  id: string;
  subprocessor_name: string;
  subprocessor_role: string;
  dpa_version: string;
  signed_at: string;
  expires_at: string | null;
};

export function DpaList({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouveau DPA
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun DPA enregistré"
          description="Pré-remplissez vos accords sous-traitant pour les services tiers détectés."
          action={{
            href: '/admin/legal/dpa/pre-remplir',
            label: 'Pré-remplir',
          }}
        />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="p-12 text-left font-medium">Sous-traitant</th>
                <th className="p-12 text-left font-medium">Rôle</th>
                <th className="p-12 text-left font-medium">Version</th>
                <th className="p-12 text-left font-medium">Signé le</th>
                <th className="p-12 text-left font-medium">Expire le</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 border-b last:border-0">
                  <td className="p-12 font-medium">{e.subprocessor_name}</td>
                  <td className="p-12">{e.subprocessor_role}</td>
                  <td className="p-12 tabular-nums">{e.dpa_version}</td>
                  <td className="p-12 tabular-nums">
                    {new Date(e.signed_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="text-muted-foreground p-12 tabular-nums">
                    {e.expires_at
                      ? new Date(e.expires_at).toLocaleDateString('fr-FR')
                      : 'Évergreen'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DpaDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
