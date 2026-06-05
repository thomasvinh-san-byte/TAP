import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la liste patients (Phase 06.26, DEC-105 §5).
 * Épouse le layout : en-tête + 2 CTA, barre de recherche, lignes de
 * table (avatar + nom + métadonnées). Le shimmer respecte
 * `prefers-reduced-motion` via la règle globale globals.css.
 */
export default function PatientsLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <Skeleton className="h-8 w-32" />
        <div className="flex items-center gap-12">
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      <Skeleton className="h-10 w-full max-w-md rounded-md" />

      <div className="space-y-8">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-12">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <Skeleton className="h-12 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
