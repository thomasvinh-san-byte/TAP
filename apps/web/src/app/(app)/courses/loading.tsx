import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la liste courses (Phase 06.26, DEC-105 §5).
 * Épouse le layout : en-tête + CTA, barre de filtres (date + statut +
 * mode + recherche), lignes de table. Le shimmer respecte
 * `prefers-reduced-motion` via la règle globale globals.css.
 */
export default function CoursesLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <div className="space-y-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>

      <div className="flex flex-wrap items-center gap-12">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>

      <div className="space-y-8">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
