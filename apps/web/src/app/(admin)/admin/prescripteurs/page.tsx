import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { PageHeader } from '@/components/page-header';
import { getCachedPrescribersPageData } from './_lib/cached-queries';
import { PrescribersList } from './_components/prescribers-list.client';

export const metadata = { title: 'Prescripteurs' };
// dynamique (guard lit les cookies), donnée cachée par org et purgée à
// l'écriture (revalidateTag dans actions.ts).

export type PrescriberRow = {
  id: string;
  nom: string;
  prenom: string | null;
  type: 'medecin' | 'etablissement';
  rpps: string | null;
  adeli: string | null;
  finess: string | null;
  specialite: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  adresse: string | null;
  actif: boolean;
  created_at: string;
};

/**
 * Données cachées par organisation ; guard dirigeant + régulateur.
 *
 * Le prescripteur (médecin/établissement émetteur de la prescription) est
 * DISTINCT du donneur d'ordres (qui commande/paie) et du patient (transporté).
 * Préalable de la gestion des prescriptions (§5.3, lot suivant).
 */
export default async function PrescripteursPage() {
  const ctx = await requireAdminOrRegulateurPage();
  const prescribers = await getCachedPrescribersPageData(ctx.organizationId);

  return (
    <div className="space-y-24">
      <PageHeader
        title="Prescripteurs"
        description="Référentiel des médecins et établissements à l'origine des prescriptions de transport. Distinct du donneur d'ordres (qui commande) et du patient (transporté)."
      />
      <PrescribersList initialPrescribers={prescribers} />
    </div>
  );
}
