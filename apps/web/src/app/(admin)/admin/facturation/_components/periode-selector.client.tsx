'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { ChauffeurOption } from '../_lib/queries-facturation';

/** 12 derniers mois (du plus récent au plus ancien), format `YYYY-MM`. */
function recentMonths(): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 1; i <= 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    });
  }
  return out;
}

const SELECT_CLASS =
  'border-border bg-background h-9 rounded-md border px-12 text-sm ' +
  'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2';

export function PeriodeSelector({
  mois,
  chauffeurId,
  chauffeurs,
}: {
  mois: string;
  chauffeurId?: string;
  chauffeurs: ChauffeurOption[];
}): JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const months = recentMonths();

  function update(next: { mois?: string; chauffeur?: string }): void {
    const params = new URLSearchParams();
    params.set('mois', next.mois ?? mois);
    const ch = next.chauffeur !== undefined ? next.chauffeur : chauffeurId;
    if (ch) params.set('chauffeur', ch);
    startTransition(() => router.push(`/admin/facturation?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-16" aria-busy={pending}>
      <label className="space-y-8 text-sm">
        <span className="text-muted-foreground block font-medium">Période</span>
        <select
          value={mois}
          disabled={pending}
          onChange={(e) => update({ mois: e.target.value })}
          className={SELECT_CLASS}
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-8 text-sm">
        <span className="text-muted-foreground block font-medium">Chauffeur</span>
        <select
          value={chauffeurId ?? ''}
          disabled={pending}
          onChange={(e) => update({ chauffeur: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">Tous les chauffeurs</option>
          {chauffeurs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
