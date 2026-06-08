import { createClient } from '@/lib/supabase/server';
import { VehiclesList } from './_components/vehicles-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Véhicules' };
export const dynamic = 'force-dynamic';

/**
 * Page admin véhicules (clôture-bis Passe 1) — RSC pré-fetch.
 * Pattern miroir `/admin/chauffeurs`. RLS Postgres + guard rôle dirigeant
 * dans `(admin)/layout.tsx` → defense in depth.
 */
export default async function VehiculesPage() {
  await requireDirigeantPage();
  const supabase = await createClient();
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

  // Conformité (Phase 06.33) : prochaine échéance par véhicule.
  const complianceRes = await supabase
    .from('compliance_items' as never)
    .select('entity_id, expires_at')
    .eq('entity_type', 'vehicle')
    .eq('archive', false)
    .not('expires_at', 'is', null)
    .order('expires_at', { ascending: true });

  const nextComplianceByVehicleId: Record<string, string> = {};
  for (const r of (complianceRes.data as { entity_id: string; expires_at: string }[] | null) ??
    []) {
    if (!nextComplianceByVehicleId[r.entity_id]) {
      nextComplianceByVehicleId[r.entity_id] = r.expires_at;
    }
  }

  return (
    <div className="space-y-24">
      <PageHeader
        title="Véhicules"
        description="Référentiel des véhicules de l'organisation. Une immatriculation active ne peut pas être saisie deux fois."
      />
      <VehiclesList
        initialVehicles={(vehicles ?? []) as VehicleRow[]}
        nextComplianceByVehicleId={nextComplianceByVehicleId}
      />
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
