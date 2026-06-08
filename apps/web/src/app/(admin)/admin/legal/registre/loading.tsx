import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton de chargement du registre des traitements (Phase 06.30, DEC-110).
 * Épouse le layout : en-tête + description longue + 2 CTA, 6 lignes de
 * table (purpose + base légale + rétention + transfert + date).
 */
export default function RegistreLoading(): JSX.Element {
  return (
    <div className="space-y-24">
      <div className="flex flex-wrap items-start justify-between gap-16">
        <div className="space-y-8">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="flex gap-12">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
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
