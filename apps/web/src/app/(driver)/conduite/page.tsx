import { Calendar } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { listMyRidesUpcoming, type RideForDriverWithBucket } from './_lib/queries';
import { RideCard } from './_components/ride-card.client';
import { ActivationToast } from './_components/activation-toast.client';
import { GeolocConsentBanner } from './_components/geoloc-consent-banner.client';

export const metadata = { title: 'Ma journée' };
export const dynamic = 'force-dynamic';

/**
 * Page « Ma journée » (Phase 3 / 03-E, élargie clôture Passe 1).
 *
 * RSC : `listMyRidesUpcoming()` filtre RLS + applicatif (driver_id ↔ profil
 * authentifié) et borne sur 48 h en `Indian/Reunion`. Les courses sont
 * regroupées en deux clusters « Aujourd'hui » / « Demain » pour donner de
 * la prévisibilité au chauffeur sans surcharger la liste.
 *
 * <ActivationToast /> consomme `?activated=1` (FLAG #1, PLAN-4 §4.8bis) et
 * déclenche le toast success après acceptation invitation chauffeur.
 */
export default async function ConduitePage() {
  const rides = await listMyRidesUpcoming();

  if (rides.length === 0) {
    return (
      <>
        <ActivationToast />
        <div className="flex flex-col items-center gap-12 py-48 text-center">
          <Calendar className="text-muted-foreground h-48 w-48" aria-hidden strokeWidth={1.5} />
          <h1 className="text-2xl font-semibold tracking-tight">
            Pas de course pour l&apos;instant
          </h1>
          <p className="text-muted-foreground max-w-[320px] text-base">
            Vos prochaines courses apparaîtront ici dès qu&apos;elles vous seront assignées.
          </p>
        </div>
      </>
    );
  }

  const today = rides.filter((r) => r.bucket === 'today');
  const tomorrow = rides.filter((r) => r.bucket === 'tomorrow');

  return (
    <>
      <ActivationToast />
      <div className="space-y-24">
        <GeolocConsentBanner />
        <PageHeader
          title="Ma journée"
          actions={
            <span className="text-muted-foreground text-sm tabular-nums">
              {rides.length} course{rides.length > 1 ? 's' : ''}
            </span>
          }
        />

        {today.length > 0 && <RideCluster label="Aujourd'hui" rides={today} />}
        {tomorrow.length > 0 && <RideCluster label="Demain" rides={tomorrow} />}
      </div>
    </>
  );
}

function RideCluster({ label, rides }: { label: string; rides: RideForDriverWithBucket[] }) {
  return (
    <section className="space-y-12">
      <h2 className="text-muted-foreground text-sm font-medium">{label}</h2>
      <ul className="space-y-16" aria-label={`Courses ${label.toLowerCase()}`}>
        {rides.map((r) => (
          // Clé inclut `status` pour forcer le re-mount de RideCard et son
          // arbre client (RideActions) au changement de statut, sinon
          // router.refresh() repeuple le RSC mais le composant client
          // reste figé sur l'ancien bouton (Phase 03.2 #4 + DEC-033).
          <li key={`${r.id}-${r.status}`}>
            <RideCard ride={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}
