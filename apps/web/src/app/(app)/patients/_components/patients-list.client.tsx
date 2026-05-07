'use client';

import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchPatientsAction } from '../actions';
import { PatientSearch } from './patient-search.client';
import { PatientDrawer } from './patient-drawer.client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface PatientListItem {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  canal_contact_prefere: 'sms' | 'appel' | 'aucun';
}

/**
 * Liste patients + recherche fuzzy (PAT-01, PAT-03, PAT-04).
 *
 * - `useDeferredValue` : debounce React natif aligné sur la fluidité du
 *   typing ; pas de setTimeout manuel.
 * - `enabled` : 1 char ne déclenche jamais la requête (D-10).
 * - `placeholderData: prev` : pas de flash de skeleton entre frappes.
 */
export function PatientsList() {
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['patients', { q: dq }],
    queryFn: () => searchPatientsAction(dq),
    enabled: dq.length === 0 || dq.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  return (
    <div className="space-y-16">
      <PatientSearch value={q} onChange={setQ} />

      {q.length === 1 && (
        <p className="text-sm text-muted-foreground">
          Tapez au moins 2 caractères pour lancer la recherche.
        </p>
      )}

      {isPending && !data && (
        <ul className="space-y-8" aria-label="Chargement des patients">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i}>
              <Skeleton className="h-48 w-full" />
            </li>
          ))}
        </ul>
      )}

      {data && data.length === 0 && q.length >= 2 && !isFetching && (
        <p className="text-sm text-muted-foreground">
          Aucun patient ne correspond à « {q} ».
        </p>
      )}

      {data && data.length > 0 && (
        <ul
          className="divide-y divide-border rounded-md border border-border"
          aria-label="Résultats de recherche"
        >
          {data.map((p: PatientListItem) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className="flex w-full items-center justify-between px-16 py-12 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium tabular-nums">
                  {p.nom} {p.prenom}
                </span>
                <span className="flex items-center gap-12 text-sm text-muted-foreground">
                  {p.telephone && (
                    <span className="tabular-nums">{p.telephone}</span>
                  )}
                  <Badge variant="secondary">{p.canal_contact_prefere}</Badge>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PatientDrawer
        patientId={openId}
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
      />
    </div>
  );
}
