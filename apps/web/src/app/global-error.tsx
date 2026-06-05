'use client';

/**
 * Phase 06.20 (DEC-097) — Global error boundary root.
 *
 * Capte les erreurs non gérées du root layout (qui passent à travers
 * tous les `error.tsx` segmentés). Reporte à Sentry puis affiche une UI
 * dégradée propre — pas d'écran blanc.
 *
 * Note Next.js : `global-error` DOIT être un Client Component et DOIT
 * définir son propre <html>/<body> (il remplace le root layout en cas
 * d'erreur).
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-16 p-24 text-center">
        <h1 className="text-2xl font-semibold">Une erreur est survenue</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          Le problème a été remonté à l&apos;équipe technique. Vous pouvez recharger la page ou
          retourner à l&apos;écran précédent.
        </p>
        <a
          href="/"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-md px-16 text-sm font-medium"
        >
          Retour à l&apos;accueil
        </a>
      </body>
    </html>
  );
}
