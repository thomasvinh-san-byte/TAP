'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <div className="rounded-lg border border-dashed p-48 text-center">
          <p className="text-muted-foreground">Aucun DPA enregistré.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left p-12 font-medium">Sous-traitant</th>
                <th className="text-left p-12 font-medium">Rôle</th>
                <th className="text-left p-12 font-medium">Version</th>
                <th className="text-left p-12 font-medium">Signé le</th>
                <th className="text-left p-12 font-medium">Expire le</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-12 font-medium">{e.subprocessor_name}</td>
                  <td className="p-12">{e.subprocessor_role}</td>
                  <td className="p-12 tabular-nums">{e.dpa_version}</td>
                  <td className="p-12 tabular-nums">
                    {new Date(e.signed_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-12 tabular-nums text-muted-foreground">
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
