import { createClient } from '@/lib/supabase/server';
import { VehiclesList } from './_components/vehicles-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';

export const metadata = { title: 'Véhicules' };
export const dynamic = 'force-dynamic';

/**
 * Page admin véhicules (clôture-bis Passe 1) — RSC pré-fetch.
 * Pattern miroir `/admin/chauffeurs`. RLS Postgres + guard rôle dirigeant
 * dans `(admin)/layout.tsx` → defense in depth.
 */
export default async function VehiculesPage() {
  await requireDirigeantPage();
  const supabase = createClient();
  const { data: vehicles, error: vehiclesError } = await supabase
    .from('vehicles' as never)
    .select(
      'id, immatriculation, marque, modele, type, places_assises, places_tpmr, actif, created_at',
    )
    .eq('archive', false)
    .order('immatriculation', { ascending: true });
  if (vehiclesError) {
    console.error('[admin/vehicules] Erreur Supabase:', vehiclesError);
  }

  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Véhicules</h1>
        <p className="text-muted-foreground text-sm">
          Référentiel des véhicules de l&apos;organisation. Une immatriculation active ne peut pas
          être saisie deux fois.
        </p>
      </header>
      <VehiclesList initialVehicles={(vehicles ?? []) as VehicleRow[]} />
    </div>
  );
}

export type VehicleRow = {
  id: string;
  immatriculation: string;
  marque: string | null;
  modele: string | null;
  type: 'taxi_conventionne' | 'tpmr' | 'vsl' | 'ambulance';
  places_assises: number | null;
  places_tpmr: number | null;
  actif: boolean;
  created_at: string;
};
