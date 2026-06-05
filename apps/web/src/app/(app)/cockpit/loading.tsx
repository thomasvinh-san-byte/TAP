import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement du cockpit régulateur (Phase 06.26, DEC-105 §5).
 * Épouse le layout réel : section gauche (en-tête « Ma journée » + courses
 * + panneau positions) et aside droite (panneau alertes). Le shimmer
 * respecte `prefers-reduced-motion` via la règle globale globals.css.
 */
export default function CockpitLoading(): JSX.Element {
  return (
    <div className="flex flex-col gap-16 lg:flex-row lg:items-stretch lg:gap-24">
      <section className="min-w-0 flex-1 space-y-16">
        <div className="flex flex-wrap items-center justify-between gap-16">
          <div className="space-y-8">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex items-center gap-12">
            <Skeleton className="h-10 w-48 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>

        <div className="space-y-8">
          <Skeleton className="h-10 w-full rounded-lg" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>

        <div className="space-y-12">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </section>

      <aside className="lg:border-border w-full shrink-0 lg:w-80 lg:border-l lg:pl-24">
        <div className="space-y-12">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </aside>
    </div>
  );
}
