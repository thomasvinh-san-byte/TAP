import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la liste prescripteurs (DEC-162).
 * Épouse le layout : en-tête + CTA, compteur, 6 lignes de table.
 */
export default function PrescripteursLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <div className="space-y-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-56 rounded-md" />
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
