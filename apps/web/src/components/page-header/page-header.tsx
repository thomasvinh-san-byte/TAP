import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * <PageHeader> — en-tête de page commun (Phase 06.16 D-01).
 *
 * Composant strictement présentationnel, esprit Linear/Stripe (sobre,
 * dense). Reproduit le pattern existant des 16 pages admin (`<h1>`
 * 2xl semibold tracking-tight + `<p>` muted text-sm). Slot `actions`
 * optionnel à droite (utilisé seulement par `legal/registre`).
 *
 * Tokens 06.14 uniquement (classes sémantiques), 0 hex. RGAA : un seul
 * `<h1>` par page (responsabilité de l'appelant).
 */

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Classe additionnelle sur le `<header>` racine. */
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <header
      className={cn(actions ? 'flex items-center justify-between gap-16' : undefined, className)}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-4 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex gap-12">{actions}</div> : null}
    </header>
  );
}
