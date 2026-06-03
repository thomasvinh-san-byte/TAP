'use client';

import { LayoutDashboard } from 'lucide-react';
import { CourseRow } from './course-row.client';
import { EmptyState } from '@/components/ui/empty-state';
import type { CockpitRide } from '../_lib/types';

export function CoursesTable({
  rides,
  newRideIds,
}: {
  rides: CockpitRide[];
  newRideIds: Set<string>;
}): JSX.Element {
  if (rides.length === 0) {
    return (
      <EmptyState
        icon={LayoutDashboard}
        title="Aucune course en cours"
        description="Aucune activité opérationnelle pour le moment. Les nouvelles courses apparaîtront ici en temps réel."
      />
    );
  }

  return (
    <div className="border-border bg-background overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse">
        <thead className="bg-muted/40">
          <tr className="border-border text-muted-foreground h-10 border-b text-xs uppercase tracking-wide">
            <th className="px-12 text-left font-medium">Heure</th>
            <th className="px-12 text-left font-medium">Patient</th>
            <th className="px-12 text-left font-medium">Départ</th>
            <th className="px-12 text-left font-medium">Chauffeur</th>
            <th className="px-12 text-left font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {rides.map((ride) => (
            <CourseRow key={ride.id} ride={ride} isNew={newRideIds.has(ride.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
