import { VehiclesList } from './_components/vehicles-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import { getCachedVehiculesPageData } from './_lib/cached-queries';

export const metadata = { title: 'Véhicules' };
// DEC-153 (perf 08.04) : data-cache par organisation (cf. _lib/cached-queries.ts).
// Plus de force-dynamic — la page reste dynamique (guard requireDirigeantPage lit
// les cookies) mais la donnée est servie depuis un cache par org, purgé à
// l'écriture (revalidateTag dans actions.ts).

/**
 * Page admin véhicules (clôture-bis Passe 1) — RSC pré-fetch.
 * Pattern miroir `/admin/chauffeurs`. Données cachées par organisation
 * (DEC-153) ; guard rôle dirigeant via `requireDirigeantPage`.
 */
export default async function VehiculesPage() {
  const ctx = await requireDirigeantPage();
  const { vehicles, nextComplianceByVehicleId } = await getCachedVehiculesPageData(
    ctx.organizationId,
  );

  return (
    <div className="space-y-24">
      <PageHeader
        title="Véhicules"
        description="Référentiel des véhicules de l'organisation. Une immatriculation active ne peut pas être saisie deux fois."
      />
      <VehiclesList
        initialVehicles={vehicles}
        nextComplianceByVehicleId={nextComplianceByVehicleId}
        uploadEnabled={process.env.UPLOAD_DOCS_ENABLED === 'true'}
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
  // VEHICULE-01 (§5.7) : équipements de compatibilité.
  equipement_oxygene: boolean;
  equipement_brancard: boolean;
  capacite_charge_kg: number | null;
  equipement_autre: string | null;
  actif: boolean;
  created_at: string;
};
