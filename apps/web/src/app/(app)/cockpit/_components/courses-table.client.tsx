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
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-24 py-48 text-center">
        <CalendarPlus aria-hidden className="h-32 w-32 text-muted-foreground/60" />
        <p className="mt-12 text-base font-medium text-foreground">
          Aucune course aujourd&apos;hui
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Les nouvelles courses apparaîtront ici en temps réel.
        </p>
        <Link
          href="/courses"
          className="mt-16 inline-flex h-10 items-center rounded-md bg-primary px-16 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Créer une course
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-background">
      <table className="w-full border-collapse">
        <thead className="bg-muted/40">
          <tr className="h-10 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
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
