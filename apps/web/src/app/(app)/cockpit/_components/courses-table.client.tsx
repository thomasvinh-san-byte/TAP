'use client';

import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { StatusBadge } from '../../courses/_components/ride-badges';
import type { CockpitRide } from '../_lib/types';

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Reunion',
  });
}

function formatName(person: CockpitRide['patient']): string {
  if (!person) return '—';
  const parts = [person.prenom, person.nom].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '—';
}

const COLUMNS: DataTableColumn<CockpitRide>[] = [
  {
    key: 'heure',
    header: 'Heure',
    cell: (ride) => <span className="tabular-nums">{formatTime(ride.scheduled_at)}</span>,
  },
  {
    key: 'patient',
    header: 'Patient',
    cell: (ride) => (
      <span className="text-foreground block truncate font-medium">{formatName(ride.patient)}</span>
    ),
  },
  {
    key: 'depart',
    header: 'Départ',
    // Adresse = colonne non essentielle : tronquée proprement (max-width réduite)
    // pour laisser la largeur aux colonnes essentielles (chauffeur, statut).
    cell: (ride) => (
      <span className="text-muted-foreground block max-w-[160px] truncate">
        {ride.pickup_address || '—'}
      </span>
    ),
  },
  {
    key: 'chauffeur',
    header: 'Chauffeur',
    // Essentiel : jamais coupé — pas de retour à la ligne (défile avec la tuile
    // si la largeur manque plutôt que d'être tronqué).
    cell: (ride) => <span className="whitespace-nowrap">{ride.driver?.nom_affichage ?? '—'}</span>,
  },
  {
    key: 'statut',
    header: 'Statut',
    cell: (ride) => <StatusBadge status={ride.status} />,
  },
];

export function CoursesTable({
  rides,
  newRideIds,
  className,
}: {
  rides: CockpitRide[];
  newRideIds: Set<string>;
  /** Classe transmise au conteneur du tableau (ex. neutraliser la bordure quand
   *  le tableau est posé dans une tuile bento qui porte déjà le chrome de carte). */
  className?: string;
}): JSX.Element {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rides}
      rowKey={(ride) => `${ride.id}:${ride.status}`}
      className={className}
      ariaLabel="Liste des courses en cours dans le cockpit régulateur"
      rowClassName={(ride) => (newRideIds.has(ride.id) ? 'cockpit-row-fade-in' : '')}
      emptyState={
        <EmptyState
          icon={LayoutDashboard}
          title="Aucune course en cours"
          description="Aucune activité opérationnelle pour le moment. Les nouvelles courses apparaîtront ici en temps réel."
        />
      }
    />
  );
}
