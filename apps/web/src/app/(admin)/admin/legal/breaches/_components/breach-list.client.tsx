'use client';

import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
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
        <EmptyState
          icon={ShieldCheck}
          title="Aucun incident enregistré"
          description="Aucune violation de données déclarée. En cas d'incident, déclarez-le ici — vous avez 72 h pour notifier la CNIL, un compte à rebours vous accompagne."
        />
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="p-12 text-left font-medium">Détecté le</th>
                <th className="p-12 text-left font-medium">Gravité</th>
                <th className="p-12 text-left font-medium">Nature</th>
                <th className="p-12 text-left font-medium">Description</th>
                <th className="p-12 text-left font-medium">Délai CNIL</th>
                <th className="p-12 text-left font-medium">État</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const showTimer =
                  e.cnil_notification_required && !e.cnil_notification_at && !e.closed_at;
                return (
                  <tr key={e.id} className="hover:bg-muted/20 border-b last:border-0">
                    <td className="p-12 tabular-nums">
                      {new Date(e.detected_at).toLocaleString('fr-FR')}
                    </td>
                    <td className="p-12">
                      <Badge variant="outline">{e.severity}</Badge>
                    </td>
                    <td className="p-12">{e.nature}</td>
                    <td className="max-w-[300px] truncate p-12">{e.description}</td>
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
