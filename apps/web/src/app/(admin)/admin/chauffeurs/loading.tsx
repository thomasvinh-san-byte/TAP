import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la liste chauffeurs (Phase 06.30, DEC-110).
 * Épouse le layout : en-tête + CTA, compteur, 8 lignes de table (nom +
 * téléphone + permis + statut + actions). Le shimmer respecte
 * `prefers-reduced-motion` via la règle globale `globals.css`.
 */
export default function ChauffeursLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <div className="space-y-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
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
