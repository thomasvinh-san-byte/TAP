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

export function CourseRow({
  ride,
  isNew,
}: {
  ride: CockpitRide;
  isNew: boolean;
}): JSX.Element {
  const animationClass = isNew ? 'cockpit-row-fade-in' : '';
  return (
    <tr className={`h-10 border-b border-border hover:bg-muted/30 ${animationClass}`}>
      <td className="px-12 tabular-nums text-sm">{formatTime(ride.scheduled_at)}</td>
      <td className="px-12 truncate text-sm font-medium text-foreground">
        {formatName(ride.patient)}
      </td>
      <td className="px-12 truncate text-sm text-muted-foreground max-w-[280px]">
        {ride.pickup_address || '—'}
      </td>
      <td className="px-12 text-sm">{ride.driver?.prenom ?? '—'}</td>
      <td className="px-12">
        <StatusBadge status={ride.status} />
      </td>
    </tr>
  );
}
