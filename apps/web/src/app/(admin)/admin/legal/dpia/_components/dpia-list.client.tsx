'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DpiaForm } from './dpia-form.client';

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

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-8 h-16 w-16" aria-hidden />
          Nouvelle DPIA
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-48 text-center">
          <p className="text-muted-foreground">Aucune DPIA.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left p-12 font-medium">Titre</th>
                <th className="text-left p-12 font-medium">Statut</th>
                <th className="text-left p-12 font-medium">Risque résiduel</th>
                <th className="text-left p-12 font-medium">Revue le</th>
                <th className="text-left p-12 font-medium">Prochaine</th>
                <th className="text-right p-12 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-12 font-medium">{e.title}</td>
                  <td className="p-12">
                    <Badge variant={e.status === 'validee' ? 'default' : 'outline'}>
                      {e.status}
                    </Badge>
                  </td>
                  <td className="p-12">
                    {e.residual_risk_level ?? '—'}
                  </td>
                  <td className="p-12 tabular-nums">
                    {new Date(e.reviewed_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-12 tabular-nums">
                    {new Date(e.next_review_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-12 text-right">
                    <Button variant="outline" size="sm" onClick={() => setEditing(e.id)}>
                      Modifier
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <DpiaForm
          mode="create"
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <DpiaForm
          mode="edit"
          dpiaId={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
