import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la caisse (Phase 06.26, DEC-105 §5).
 * Épouse le layout : en-tête + barre d'outils (date + chauffeur + moyen
 * + export), bloc résumé (totaux par moyen), lignes de table. Le shimmer
 * respecte `prefers-reduced-motion` via la règle globale globals.css.
 */
export default function CaisseLoading(): JSX.Element {
  return (
    <div className="max-w-[1280px] space-y-24">
      <div className="space-y-8">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="flex flex-wrap items-center gap-12">
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-md" />
        <Skeleton className="h-10 w-40 rounded-md" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>

      <div className="space-y-8">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
