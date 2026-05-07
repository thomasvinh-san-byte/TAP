'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RequestDrawer } from './request-drawer.client';

type Entry = {
  id: string;
  request_type: string;
  status: string;
  requested_at: string;
  deadline_at: string;
  requester_email: string | null;
  response_at: string | null;
};

export function RequestsList({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvelle demande
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-48 text-center">
          <p className="text-muted-foreground">Aucune demande enregistrée.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left p-12 font-medium">Type</th>
                <th className="text-left p-12 font-medium">Statut</th>
                <th className="text-left p-12 font-medium">Reçue le</th>
                <th className="text-left p-12 font-medium">Échéance</th>
                <th className="text-left p-12 font-medium">Demandeur</th>
                <th className="text-left p-12 font-medium">Répondue le</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-12">
                    <Badge variant="outline">{e.request_type}</Badge>
                  </td>
                  <td className="p-12">{e.status}</td>
                  <td className="p-12 tabular-nums">
                    {new Date(e.requested_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-12 tabular-nums">
                    {new Date(e.deadline_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-12 text-muted-foreground">
                    {e.requester_email ?? '—'}
                  </td>
                  <td className="p-12 tabular-nums text-muted-foreground">
                    {e.response_at
                      ? new Date(e.response_at).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RequestDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
