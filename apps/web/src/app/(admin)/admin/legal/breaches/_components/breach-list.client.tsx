'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BreachTimer } from './breach-timer.client';
import { BreachDrawer } from './breach-drawer.client';

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

export function BreachList({ entries }: { entries: Entry[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvel incident
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-48 text-center">
          <p className="text-muted-foreground">Aucun incident enregistré.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left p-12 font-medium">Détecté le</th>
                <th className="text-left p-12 font-medium">Gravité</th>
                <th className="text-left p-12 font-medium">Nature</th>
                <th className="text-left p-12 font-medium">Description</th>
                <th className="text-left p-12 font-medium">Délai CNIL</th>
                <th className="text-left p-12 font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const showTimer =
                  e.cnil_notification_required &&
                  !e.cnil_notification_at &&
                  !e.closed_at;
                return (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-12 tabular-nums">
                      {new Date(e.detected_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-12">
                      <Badge variant="outline">{e.severity}</Badge>
                    </td>
                    <td className="p-12">{e.nature}</td>
                    <td className="p-12 max-w-[300px] truncate">{e.description}</td>
                    <td className="p-12">
                      {showTimer ? (
                        <BreachTimer detectedAt={e.detected_at} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-12">
                      {e.closed_at ? (
                        <Badge>Clôturé</Badge>
                      ) : (
                        <Badge variant="outline">Ouvert</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BreachDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
