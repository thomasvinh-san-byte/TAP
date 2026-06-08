import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la grille tarifaire (Phase 06.30, DEC-110).
 * Épouse le layout : en-tête + description, card grille active
 * (titre + ~5 lignes clé/valeur), historique des versions.
 */
export default function TarifsLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="border-border space-y-12 rounded-md border p-16">
        <div className="flex items-start justify-between gap-12">
          <div className="space-y-8">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-16">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>

      <div className="space-y-12">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
