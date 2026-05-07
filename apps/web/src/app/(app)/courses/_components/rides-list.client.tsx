'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listRidesAction } from '../actions';
import type {
  RideRow,
  RideStatus,
  RideTransportMode,
} from '../_lib/queries';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/**
 * RidesList (Phase 2 / Wave 4 — D-07).
 *
 * Tableau client interactif des courses. La donnée initiale est pré-fetchée
 * en RSC par `/courses/page.tsx` via HydrationBoundary ; ici on consomme
 * `useQuery` pour les filtres et la recherche live (DEC-005 : pas de
 * useEffect-fetch). Recherche fuzzy locale dans pickup/dropoff (les filtres
 * status/mode déclenchent de vraies requêtes server-side).
 */
const STATUS_FILTERS = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'validee', label: 'Validées' },
  { value: 'assignee', label: 'Assignées' },
  { value: 'en_cours', label: 'En cours' },
  { value: 'terminee', label: 'Terminées' },
] as const;

const MODE_FILTERS = [
  { value: 'all', label: 'Tous modes' },
  { value: 'taxi_conventionne', label: 'Taxi conventionné' },
  { value: 'tpmr', label: 'TPMR' },
  { value: 'vsl', label: 'VSL' },
  { value: 'ambulance', label: 'Ambulance' },
] as const;

const URGENCY_LABEL: Record<string, string> = {
  programmee: 'Programmée',
  urgente: 'Urgente',
  immediate: 'Immédiate',
};

const STATUS_LABEL: Record<string, string> = {
  validee: 'Validée',
  assignee: 'Assignée',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee_regulateur: 'Annulée (régulateur)',
  annulee_patient: 'Annulée (patient)',
  annulee_chauffeur: 'Annulée (chauffeur)',
  brouillon: 'Brouillon',
};

const MODE_LABEL: Record<string, string> = {
  taxi_conventionne: 'Taxi conv.',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

export function RidesList(): JSX.Element {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const dq = useDeferredValue(q);

  const { data, isPending } = useQuery({
    queryKey: ['rides', { status: statusFilter, mode: modeFilter }],
    queryFn: () =>
      listRidesAction({
        status:
          statusFilter === 'all' ? undefined : (statusFilter as RideStatus),
        transport_mode:
          modeFilter === 'all'
            ? undefined
            : (modeFilter as RideTransportMode),
      }),
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  const rides = (data ?? []) as RideRow[];
  const filtered = rides.filter((r) => {
    if (!dq) return true;
    const lower = dq.toLowerCase();
    return (
      r.pickup_address.toLowerCase().includes(lower) ||
      r.dropoff_address.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="space-y-16">
      <div className="flex flex-wrap gap-12 items-end">
        <div className="flex-1 min-w-[240px]">
          <Input
            aria-label="Rechercher dans les adresses"
            placeholder="Rechercher dans les adresses…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          aria-label="Filtre statut"
          className="h-40 rounded-md border bg-background px-12 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtre mode de transport"
          className="h-40 rounded-md border bg-background px-12 text-sm"
          value={modeFilter}
          onChange={(e) => setModeFilter(e.target.value)}
        >
          {MODE_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {isPending && (
        <div className="space-y-8" aria-label="Chargement des courses">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </div>
      )}

      {!isPending && filtered.length === 0 && (
        <div className="border rounded-md p-32 text-center text-sm text-muted-foreground">
          Aucune course ne correspond aux critères.
        </div>
      )}

      {!isPending && filtered.length > 0 && (
        <table className="w-full text-sm" aria-label="Liste des courses">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-8 pr-12">Date</th>
              <th className="py-8 pr-12">Patient</th>
              <th className="py-8 pr-12">Trajet</th>
              <th className="py-8 pr-12">Mode</th>
              <th className="py-8 pr-12">Urgence</th>
              <th className="py-8 pr-12">Statut</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-12 pr-12 tabular-nums">
                  {new Date(r.scheduled_at).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
                <td className="py-12 pr-12">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {r.patient_id.slice(0, 8)}…
                  </span>
                </td>
                <td className="py-12 pr-12">
                  <span className="block truncate max-w-[280px]">
                    {r.pickup_address} → {r.dropoff_address}
                  </span>
                </td>
                <td className="py-12 pr-12">
                  <Badge variant="outline">
                    {MODE_LABEL[r.transport_mode] ?? r.transport_mode}
                  </Badge>
                </td>
                <td className="py-12 pr-12">
                  <Badge
                    variant={r.urgency === 'immediate' ? 'destructive' : 'secondary'}
                  >
                    {URGENCY_LABEL[r.urgency] ?? r.urgency}
                  </Badge>
                </td>
                <td className="py-12 pr-12">
                  <Badge variant="secondary">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
