import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement des demandes RGPD (Phase 06.30, DEC-110).
 * Épouse le layout : en-tête + description longue, CTA, 5 lignes de
 * table (type + patient + statut + délai + date).
 */
export default function RequestsLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="space-y-8">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>

      <div className="space-y-8">
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
