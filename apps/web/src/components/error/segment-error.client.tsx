'use client';

/**
 * Phase 06.22 (DEC-099) — Gabarit commun error boundary par segment.
 *
 * Utilisé par chaque `error.tsx` segmenté :
 *   - capture Sentry au mount (06.20),
 *   - UI dégradée sobre (rôle alert, focus auto sur le bouton),
 *   - stack visible UNIQUEMENT en dev (CLAUDE.md §6 — jamais en prod),
 *   - bouton `Réessayer` qui ré-essaie le segment (`reset()` Next 15),
 *   - 0 dépendance réseau pour rendre — l'UI doit s'afficher offline aussi
 *     (cas chauffeur en course hors couverture).
 *
 * A11y : `role="alert"` annonce l'erreur aux lecteurs d'écran. `autoFocus`
 * sur le bouton permet de réessayer au clavier sans manipuler la souris.
 *
 * Jour + nuit : tokens 06.14 uniquement (0 hex). Pas d'icône lourde
 * (Lucide n'est pas garanti dispo si une erreur SSR cassait le chunk
 * — le gabarit reste lisible texte seul).
 */

import * as React from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';

export interface SegmentErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Titre court, contextualisé au segment. */
  title: string;
  /** Phrase plus longue : ce que l'utilisateur peut faire / l'état des données. */
  description: string;
  /** Tag Sentry pour identifier le segment dans les events. */
  segment: string;
}

export function SegmentError({
  error,
  reset,
  title,
  description,
  segment,
}: SegmentErrorProps): JSX.Element {
  React.useEffect(() => {
    Sentry.captureException(error, { tags: { segment } });
  }, [error, segment]);

  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-border bg-background mx-auto flex max-w-md flex-col items-center gap-16 rounded-lg border border-dashed p-32 text-center"
    >
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm leading-[1.45]">{description}</p>
      <Button autoFocus onClick={() => reset()} className="min-h-[44px]">
        Réessayer
      </Button>
      {isDev && (
        <details className="text-muted-foreground mt-12 w-full text-left text-xs">
          <summary className="cursor-pointer select-none">Détails (dev only)</summary>
          <pre className="bg-muted mt-8 max-h-64 overflow-auto rounded p-8 text-[10px]">
            {error.name}: {error.message}
            {error.digest ? `\ndigest: ${error.digest}` : ''}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        </details>
      )}
    </div>
  );
}
