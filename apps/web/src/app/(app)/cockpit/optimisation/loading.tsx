import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la page d'optimisation (Surface 7 — état loading).
 * Deux colonnes avec blocs de hauteur variable — aucun spinner (NFR-005).
 */
export default function OptimisationLoading(): JSX.Element {
  return (
    <div className="container mx-auto max-w-screen-xl space-y-24 px-32 py-24">
      <div className="flex items-center justify-between gap-16">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-16" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid gap-24 sm:grid-cols-2">
        <div className="space-y-8">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <div className="space-y-8">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
