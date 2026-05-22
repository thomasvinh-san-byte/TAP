import { redirect } from 'next/navigation';
import { getRideForDriver } from '../_lib/queries';
import { RideDetail } from '../_components/ride-detail.client';

export const dynamic = 'force-dynamic';

interface Params {
  params: { rideId: string };
}

/**
 * Détail d'une course chauffeur (Phase 3 / 03-E).
 *
 * RSC : `getRideForDriver(rideId)` revient null si l'utilisateur n'est pas
 * le chauffeur assigné OU si la course n'existe pas — on redirige vers
 * `/conduite` (zéro fuite d'information).
 */
export default async function RideDetailPage({ params }: Params) {
  const ride = await getRideForDriver(params.rideId);
  if (!ride) {
    redirect('/conduite');
  }
  return <RideDetail ride={ride} />;
}

export async function generateMetadata({ params }: Params) {
  const ride = await getRideForDriver(params.rideId);
  if (!ride) return { title: 'Course' };
  return {
    title: ride.patient.nom || 'Course',
  };
}
