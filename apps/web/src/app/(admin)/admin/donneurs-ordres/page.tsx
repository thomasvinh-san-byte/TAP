import { createClient } from '@/lib/supabase/server';
import { OrderingPartiesList } from './_components/ordering-parties-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: "Donneurs d'ordres" };
export const dynamic = 'force-dynamic';

/**
 * Page admin donneurs d'ordres B2B (CdC §5.5, DEC-148) — RSC pré-fetch.
 * Pattern miroir `/admin/vehicules`. RLS Postgres (ordering_parties_*) +
 * guard rôle dirigeant (`requireDirigeantPage`) → defense in depth.
 *
 * Un donneur d'ordres (hôpital, clinique, EHPAD) commande des transports
 * pour ses patients/résidents. DISTINCT du prescripteur (CdC §5.5 l.186).
 */
export default async function DonneursOrdresPage() {
  await requireDirigeantPage();
  const supabase = await createClient();
  const { data: parties, error } = await supabase
    .from('ordering_parties' as never)
    .select(
      'id, raison_sociale, siret, contact_principal_nom, contact_principal_telephone, ' +
        'contact_principal_email, modalite_facturation, actif, created_at',
    )
    .eq('archive', false)
    .order('raison_sociale', { ascending: true });
  if (error) {
    console.error('[admin/donneurs-ordres] Erreur Supabase:', error);
  }

  return (
    <div className="space-y-24">
      <PageHeader
        title="Donneurs d'ordres"
        description="Référentiel des donneurs d'ordres B2B (hôpitaux, cliniques, EHPAD) qui commandent des transports pour leurs patients."
      />
      <OrderingPartiesList initialParties={(parties ?? []) as OrderingPartyRow[]} />
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
  actif: boolean;
  created_at: string;
};
