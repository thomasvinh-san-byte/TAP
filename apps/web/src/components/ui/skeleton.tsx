import { cn } from '@/lib/utils';

/**
 * `motion-reduce:animate-none` (Phase 06.32, DEC-111 annexe) : garde
 * locale explicite en complément de la règle globale `globals.css:30-37`
 * qui réduit déjà toute animation à 0.01ms sous `prefers-reduced-motion:
 * reduce`. Rend le composant auto-documenté/robuste hors contexte global.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
