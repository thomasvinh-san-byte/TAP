'use client';

import Link from 'next/link';
import { CalendarPlus } from 'lucide-react';
import { CourseRow } from './course-row.client';
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
      <div className="border-border bg-muted/20 flex flex-col items-center justify-center rounded-lg border border-dashed px-24 py-48 text-center">
        <CalendarPlus aria-hidden className="text-muted-foreground/60 h-32 w-32" />
        <p className="text-foreground mt-12 text-base font-medium">
          Aucune course aujourd&apos;hui
        </p>
        <p className="text-muted-foreground mt-4 text-sm">
          Les nouvelles courses apparaîtront ici en temps réel.
        </p>
        <Link
          href="/courses"
          className="bg-primary text-primary-foreground hover:bg-primary/90 mt-16 inline-flex h-10 items-center rounded-md px-16 text-sm font-medium"
        >
          Créer une course
        </Link>
      </div>
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
