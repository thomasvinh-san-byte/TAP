import { OrderingPartiesList } from './_components/ordering-parties-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import { getCachedDonneursOrdresPageData } from './_lib/cached-queries';

export const metadata = { title: "Donneurs d'ordres" };
// DEC-153 (perf 08.04) : data-cache par organisation (cf. _lib/cached-queries.ts).
// Plus de force-dynamic — page dynamique (guard lit les cookies), donnée cachée
// par org et purgée à l'écriture (revalidateTag dans actions.ts).

/**
 * Page admin donneurs d'ordres B2B (CdC §5.5, DEC-148) — RSC pré-fetch.
 * Données cachées par organisation (DEC-153) ; guard rôle dirigeant.
 *
 * Un donneur d'ordres (hôpital, clinique, EHPAD) commande des transports
 * pour ses patients/résidents. DISTINCT du prescripteur (CdC §5.5 l.186).
 */
export default async function DonneursOrdresPage() {
  const ctx = await requireDirigeantPage();
  const parties = await getCachedDonneursOrdresPageData(ctx.organizationId);

  return (
    <div className="space-y-24">
      <PageHeader
        title="Donneurs d'ordres"
        description="Référentiel des donneurs d'ordres B2B (hôpitaux, cliniques, EHPAD) qui commandent des transports pour leurs patients."
      />
      <OrderingPartiesList initialParties={parties} />
    </div>
  );
}

export type OrderingPartyRow = {
  id: string;
  raison_sociale: string;
  siret: string | null;
  contact_principal_nom: string | null;
  contact_principal_telephone: string | null;
  contact_principal_email: string | null;
  modalite_facturation: 'a_la_course' | 'hebdomadaire' | 'mensuelle';
  tariff_mode: 'cgss_standard' | 'grille_propre';
  actif: boolean;
  created_at: string;
};
