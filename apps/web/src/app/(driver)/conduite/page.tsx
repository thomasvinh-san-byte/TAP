import { CalendarX } from 'lucide-react';
import { listMyRidesToday } from './_lib/queries';
import { RideCard } from './_components/ride-card.client';

export const metadata = { title: 'Ma journée — TAP' };
export const dynamic = 'force-dynamic';

/**
 * Page chauffeur — vue « Ma journée » (Phase 3 / 03-E).
 *
 * RSC : `listMyRidesToday()` filtre RLS + applicatif (driver_id ↔ profil
 * authentifié) et borne la journée à `Indian/Reunion`. Cartes empilées
 * verticalement, vide → empty state CalendarX (référence Things 3).
 */
export default async function ConduitePage() {
  const rides = await listMyRidesToday();

  if (rides.length === 0) {
    return (
      <div className="flex flex-col items-center gap-12 py-48 text-center">
        <CalendarX
          className="h-48 w-48 text-muted-foreground"
          aria-hidden
        />
        <h1 className="text-lg font-semibold">
          Aucune course prévue aujourd'hui
        </h1>
        <p className="max-w-[320px] text-sm text-muted-foreground">
          Lorsque la régulation vous assignera des courses, elles apparaîtront
          ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ma journée</h1>
        <span className="text-sm text-muted-foreground tabular-nums">
          {rides.length} course{rides.length > 1 ? 's' : ''}
        </span>
      </header>
      <ul className="space-y-16" aria-label="Mes courses du jour">
        {rides.map((r) => (
          <li key={r.id}>
            <RideCard ride={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}
