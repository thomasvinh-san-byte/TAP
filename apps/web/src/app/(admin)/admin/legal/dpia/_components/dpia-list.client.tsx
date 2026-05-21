'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, ClipboardCheck } from 'lucide-react';
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
          <ClipboardCheck className="text-muted-foreground mx-auto h-32 w-32" aria-hidden />
          <p className="text-foreground mt-16 font-medium">Aucune analyse d&apos;impact.</p>
          <p className="text-muted-foreground mx-auto mt-8 max-w-md text-sm">
            TAP peut créer une trame d&apos;analyse d&apos;impact pour le transport de données de
            santé — la structure, à compléter par vos soins.
          </p>
          <Button asChild className="mt-24">
            <Link href="/admin/legal/dpia/pre-remplir">Créer une trame DPIA</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="p-12 text-left font-medium">Titre</th>
                <th className="p-12 text-left font-medium">Statut</th>
                <th className="p-12 text-left font-medium">Risque résiduel</th>
                <th className="p-12 text-left font-medium">Revue le</th>
                <th className="p-12 text-left font-medium">Prochaine</th>
                <th className="p-12 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-muted/20 border-b last:border-0">
                  <td className="p-12 font-medium">{e.title}</td>
                  <td className="p-12">
                    <Badge variant={e.status === 'validee' ? 'default' : 'outline'}>
                      {e.status}
                    </Badge>
                  </td>
                  <td className="p-12">{e.residual_risk_level ?? '—'}</td>
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

      {creating && <DpiaForm mode="create" onClose={() => setCreating(false)} />}
      {editing && <DpiaForm mode="edit" dpiaId={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
