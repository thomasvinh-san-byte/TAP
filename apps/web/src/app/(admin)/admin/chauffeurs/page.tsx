import { getAuthContext } from '@/lib/auth/get-auth-context';
import { PageHeader } from '@/components/page-header';
import { DriversList } from './_components/drivers-list.client';
import { getCachedChauffeursPageData } from './_lib/cached-queries';

export const metadata = { title: 'Chauffeurs' };
// DEC-152 (perf 08.03) : plus de `force-dynamic`. La page reste rendue
// dynamiquement (elle lit les cookies via getAuthContext) mais les DONNÉES sont
// servies depuis un cache PAR ORGANISATION (unstable_cache clé+tag par org,
// cf. _lib/cached-queries.ts), purgé à chaque écriture (revalidateTag dans
// actions.ts). Navigation accélérée, isolation inter-org préservée.

/**
 * Page admin chauffeurs (Passe 2 — Phase 04, hotfix DEC-029) — RSC pré-fetch.
 *
 * Query param `vue` :
 *   - `actifs` (par défaut) : chauffeurs non archivés
 *   - `archives`            : chauffeurs archivés (réservé toggle UI)
 *
 * Données cachées par organisation (DEC-152). Les guards rôle sont posés en
 * `(admin)/layout.tsx` (dirigeant ou régulateur).
 */
export default async function ChauffeursPage(props: { searchParams?: Promise<{ vue?: string }> }) {
  const searchParams = await props.searchParams;
  const ctx = await getAuthContext();
  const role = ctx?.role ?? 'regulateur';
  const vueArchives = searchParams?.vue === 'archives';

  // Filet : le layout (admin) garde déjà l'accès. Sans session, liste vide
  // (jamais de cache org sans organizationId issu de la session).
  const { drivers, nextComplianceByDriverId } = ctx
    ? await getCachedChauffeursPageData(ctx.organizationId, vueArchives)
    : { drivers: [], nextComplianceByDriverId: {} };

  return (
    <div className="space-y-24">
      <PageHeader
        title="Chauffeurs"
        description="Référentiel des chauffeurs de l'organisation. Invitez le chauffeur pour lui ouvrir l'accès à l'application."
      />
      <DriversList
        initialDrivers={drivers}
        currentRole={role as 'dirigeant' | 'regulateur'}
        vue={vueArchives ? 'archives' : 'actifs'}
        nextComplianceByDriverId={nextComplianceByDriverId}
        uploadEnabled={process.env.UPLOAD_DOCS_ENABLED === 'true'}
      />
    </div>
  );
}

export type DriverInvitationRow = {
  id: string;
  driver_id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type DriverRow = {
  id: string;
  nom_affichage: string;
  telephone: string | null;
  numero_licence: string | null;
  type_permis: string[];
  status: import('@tap/shared').DriverStatus;
  actif: boolean;
  archive: boolean;
  archive_at: string | null;
  archive_motif: string | null;
  profile_id: string | null;
  created_at: string;
  invitation: DriverInvitationRow | null;
};
