import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la facturation CGSS (Phase 06.30, DEC-110).
 * Épouse le layout : en-tête + description longue, sélecteur de mois,
 * aperçu (titre + totaux + lignes courses + CTA Télécharger PDF).
 */
export default function FacturationLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="space-y-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-3xl" />
      </div>

      <Skeleton className="h-10 w-48 rounded-md" />

      <section className="border-border space-y-16 rounded-md border p-24">
        <div className="space-y-8">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="grid gap-12 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>

        <div className="space-y-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-9 w-48 rounded-md" />
        </div>
      </section>
    </div>
  );
}
