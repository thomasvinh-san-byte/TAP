'use client';

import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Phone, X } from 'lucide-react';
import { searchPatientsAction } from '../actions';
import { PatientSearch } from './patient-search.client';
import { PatientDrawer } from './patient-drawer.client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import {
  daysFromNow,
  formatShortDateFr,
  formatTimeFr,
} from '@/lib/dates-fr';

interface PatientListItem {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  canal_contact_prefere: 'sms' | 'appel' | 'aucun';
  last_ride_at?: string | null;
  next_ride_at?: string | null;
}

const CANAL_LABEL: Record<PatientListItem['canal_contact_prefere'], string> = {
  sms: 'SMS',
  appel: 'Appel',
  aucun: 'Aucun',
};

function CanalIcon({
  canal,
}: {
  canal: PatientListItem['canal_contact_prefere'];
}): JSX.Element {
  const cls = 'h-12 w-12';
  if (canal === 'sms') return <MessageSquare className={cls} aria-hidden />;
  if (canal === 'appel') return <Phone className={cls} aria-hidden />;
  return <X className={cls} aria-hidden />;
}

function describeRides(p: PatientListItem): string {
  const last = p.last_ride_at;
  const next = p.next_ride_at;
  if (next) {
    const days = daysFromNow(next);
    if (days >= 0 && days <= 7) {
      return `Prochaine course : ${formatShortDateFr(next)} ${formatTimeFr(next)}`;
    }
  }
  if (last) {
    const days = Math.abs(daysFromNow(last));
    if (days === 0) return "Dernière course aujourd'hui";
    if (days === 1) return 'Dernière course hier';
    return `Dernière course il y a ${days} jours`;
  }
  return 'Aucune course enregistrée';
}

/**
 * Liste patients enrichie (Phase 3 / 03-D).
 *
 * Pour chaque ligne :
 *   - InitialsAvatar 32 (hash déterministe sur le nom complet)
 *   - Nom Prénom + sous-ligne contextuelle (dernière / prochaine course)
 *   - Badge canal_contact_prefere avec icône Lucide
 *
 * Comportement :
 *   - useDeferredValue : debounce React natif
 *   - 1 char = pas de fetch (alignement D-10)
 *   - placeholderData prev : pas de flash skeleton entre frappes
 *   - Hover ligne bg-muted/50 — clic → drawer patient existant (Phase 1)
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
              <Skeleton className="h-64 w-full" />
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
          className="divide-y divide-border rounded-md border border-border overflow-hidden"
          aria-label="Résultats de recherche"
        >
          {data.map((p: PatientListItem) => {
            const fullName = `${p.nom} ${p.prenom}`.trim();
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  className="flex w-full items-center gap-16 px-16 py-12 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  <InitialsAvatar name={fullName} size={32} />
                  <span className="flex-1 min-w-0 flex flex-col gap-4">
                    <span className="font-semibold text-foreground truncate">
                      {p.nom} {p.prenom}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {describeRides(p)}
                    </span>
                  </span>
                  <Badge variant="secondary" className="gap-4 shrink-0">
                    <CanalIcon canal={p.canal_contact_prefere} />
                    <span>{CANAL_LABEL[p.canal_contact_prefere]}</span>
                  </Badge>
                </button>
              </li>
            );
          })}
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
