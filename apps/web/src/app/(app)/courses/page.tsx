import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/page-header';
import { listRidesEnriched } from './_lib/queries';
import { RIDES_LIST_FETCH_CAP } from './_lib/list-config';
import { RidesList } from './_components/rides-list.client';
import { HeaderNewRideButton } from './_components/header-new-ride-button.client';

export const metadata = { title: 'Courses' };
export const dynamic = 'force-dynamic';

/**
 * RSC page /courses (Phase 3 / 03-D — refonte sub-header + CTA contextuel).
 *
 * Pré-fetch RLS-filtré côté serveur puis hydratation. La CLÉ et les PARAMÈTRES
 * du pré-fetch reflètent EXACTEMENT la requête par défaut du client (statut
 * « all », mode « all », date du jour, même borne) — sinon l'hydratation ne
 * nourrit pas la requête cliente (clés différentes) et la page repart d'un
 * cache vide. `today` est calculé comme côté client (`toISOString` UTC) pour que
 * les deux clés coïncident.
 * Le bouton « + Nouvelle course » est ré-attaché ici en CTA contextuel
 * (retiré du header global en 03-C). Le raccourci Cmd/Ctrl+Shift+K reste
 * le canal principal pour la régulatrice.
 */
export default async function CoursesPage() {
  const queryClient = new QueryClient();
  const today = new Date().toISOString().slice(0, 10);
  await queryClient.prefetchQuery({
    queryKey: ['rides', { status: 'all', mode: 'all', date: today }],
    queryFn: () => listRidesEnriched({ date: today, limit: RIDES_LIST_FETCH_CAP, offset: 0 }),
  });

  return (
    <div className="space-y-24">
      <PageHeader
        title="Courses"
        description={
          <span className="hidden md:inline">
            Astuce :{' '}
            <kbd className="border-border bg-muted rounded border px-4 py-2 font-mono text-xs">
              Cmd/Ctrl+Shift+K
            </kbd>{' '}
            pour saisir une course rapidement.
          </span>
        }
        actions={<HeaderNewRideButton />}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <RidesList />
      </HydrationBoundary>
    </div>
  );
}
