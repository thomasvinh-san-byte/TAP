import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement de la fiche patient (Phase 06.26, DEC-105 §5).
 * Épouse le layout : en-tête (nom + bouton Modifier) + 4 sections
 * (Identité administrative, Coordonnées, Récurrences, Préférences).
 * Le shimmer respecte `prefers-reduced-motion` via la règle globale
 * globals.css.
 */
export default function PatientLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="flex flex-wrap items-center justify-between gap-16">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {Array.from({ length: 4 }).map((_, sectionIdx) => (
        <section key={sectionIdx} className="space-y-12">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-8">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-80" />
          </div>
        </section>
      ))}
    </div>
  );
}
