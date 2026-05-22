import { Skeleton } from '@/components/ui/skeleton';

/**
 * État de chargement du tableau de bord (Phase 06.8) — squelette de la
 * grille, jamais de page blanche (UI-SPEC §6).
 */
export default function TableauDeBordLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="space-y-12">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-16 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="space-y-12">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>

      <Skeleton className="h-28 rounded-lg" />
    </div>
  );
}
