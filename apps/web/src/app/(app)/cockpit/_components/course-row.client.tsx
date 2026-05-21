'use client';

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

export function CourseRow({ ride, isNew }: { ride: CockpitRide; isNew: boolean }): JSX.Element {
  const animationClass = isNew ? 'cockpit-row-fade-in' : '';
  return (
    <tr className={`border-border hover:bg-muted/30 h-10 border-b ${animationClass}`}>
      <td className="px-12 text-sm tabular-nums">{formatTime(ride.scheduled_at)}</td>
      <td className="text-foreground truncate px-12 text-sm font-medium">
        {formatName(ride.patient)}
      </td>
      <td className="text-muted-foreground max-w-[280px] truncate px-12 text-sm">
        {ride.pickup_address || '—'}
      </td>
      <td className="px-12 text-sm">{ride.driver?.prenom ?? '—'}</td>
      <td className="px-12">
        <StatusBadge status={ride.status} />
      </td>
    </tr>
  );
}
