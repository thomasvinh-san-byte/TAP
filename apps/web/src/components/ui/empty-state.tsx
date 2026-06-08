import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Composant d'état vide réutilisable (Phase 06.11 Wave 3 — C1).
 *
 * Pattern Doctolib/Stripe : icône + titre + description courte +
 * appel à l'action principal. Centré, sobre, focusable. WCAG 2.1 AA.
 *
 * Action en discriminated union :
 *   - `href`    → rend un <Link> Next.js (navigation interne).
 *   - `onClick` → rend un <button> (ouverture modale / trigger client).
 * Cas d'usage : pages admin ouvrent souvent un drawer via onClick plutôt
 * qu'une URL dédiée.
 *
 * Usage :
 *   <EmptyState
 *     icon={Users}
 *     title="Aucun patient enregistré"
 *     description="Créez votre première fiche patient pour commencer."
 *     action={{ href: '/patients/new', label: 'Nouveau patient', icon: Plus }}
 *   />
 */

/**
 * `variant` (Phase 06.30 DEC-110) : passe `'accent'` quand l'action est
 * un moment-clé d'avancement (cohérence terracotta lot 2 DEC-104). Par
 * défaut `'default'` (bleu primaire).
 */
interface EmptyStateActionLink {
  href: string;
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'accent';
}

interface EmptyStateActionButton {
  onClick: () => void;
  label: string;
  icon?: LucideIcon;
  variant?: 'default' | 'accent';
}

export type EmptyStateAction = EmptyStateActionLink | EmptyStateActionButton;

function isLinkAction(a: EmptyStateAction): a is EmptyStateActionLink {
  return 'href' in a;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** Action secondaire (lien doc, etc.). */
  secondaryAction?: EmptyStateAction;
}

function ActionButton({
  action,
  variant = 'default',
}: {
  action: EmptyStateAction;
  variant?: 'default' | 'outline' | 'accent';
}): JSX.Element {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="mr-8 h-16 w-16" aria-hidden />}
      {action.label}
    </>
  );

  if (isLinkAction(action)) {
    return (
      <Button asChild variant={variant} className="min-h-[44px]">
        <Link href={action.href}>{content}</Link>
      </Button>
    );
  }

  return (
    <Button onClick={action.onClick} variant={variant} className="min-h-[44px]">
      {content}
    </Button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-8 py-48 text-center">
      {Icon && <Icon className="text-muted-foreground h-32 w-32" aria-hidden />}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-muted-foreground max-w-md text-sm">{description}</p>}
      {action && (
        <div className="mt-8">
          <ActionButton action={action} variant={action.variant ?? 'default'} />
        </div>
      )}
      {secondaryAction && <ActionButton action={secondaryAction} variant="outline" />}
    </div>
  );
}
