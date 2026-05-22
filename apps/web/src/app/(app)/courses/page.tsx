import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { listRidesEnriched } from './_lib/queries';
import { RidesList } from './_components/rides-list.client';
import { HeaderNewRideButton } from './_components/header-new-ride-button.client';

export const metadata = { title: 'Courses' };
export const dynamic = 'force-dynamic';

/**
 * RSC page /courses (Phase 3 / 03-D — refonte sub-header + CTA contextuel).
 *
 * Pré-fetch RLS-filtré côté serveur via `listRidesEnriched({})` puis hydratation.
 * Le bouton « + Nouvelle course » est ré-attaché ici en CTA contextuel
 * (retiré du header global en 03-C). Le raccourci Cmd/Ctrl+Shift+K reste
 * le canal principal pour la régulatrice.
 */
export default async function CoursesPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['rides', { status: 'all', mode: 'all' }],
    queryFn: () => listRidesEnriched({}),
  });

  return (
    <div className="space-y-24">
      <header className="flex flex-col gap-16 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-muted-foreground hidden text-sm md:block">
            Astuce :{' '}
            <kbd className="border-border bg-muted rounded border px-4 py-2 font-mono text-xs">
              Cmd/Ctrl+Shift+K
            </kbd>{' '}
            pour saisir une course rapidement.
          </p>
        </div>
        <HeaderNewRideButton />
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <RidesList />
      </HydrationBoundary>
    </div>
  );
}
