import {
  HydrationBoundary,
  dehydrate,
  QueryClient,
} from '@tanstack/react-query';
import { listRides } from './_lib/queries';
import { RidesList } from './_components/rides-list.client';

export const metadata = { title: 'Courses — TAP Régulation' };
export const dynamic = 'force-dynamic';

/**
 * RSC page /courses (Phase 2 / Wave 4 — D-07).
 *
 * Pré-fetch RLS-filtré côté serveur via `listRides({})` puis hydratation.
 * Les filtres (status, mode) + recherche fuzzy sont gérés côté client par
 * `<RidesList>`. Le bouton « + Nouvelle course » est livré dans le header
 * global du layout (pas ici) — D-03 modal global.
 */
export default async function CoursesPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['rides', { status: 'all', mode: 'all' }],
    queryFn: () => listRides({}),
  });

  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
        <p className="text-sm text-muted-foreground">
          Utilisez{' '}
          <kbd className="rounded border px-4 py-2 text-xs font-mono">
            Cmd/Ctrl+Shift+K
          </kbd>{' '}
          ou le bouton « Nouvelle course » pour saisir une course.
        </p>
      </header>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <RidesList />
      </HydrationBoundary>
    </div>
  );
}
