'use client';

import { Button } from '@/components/ui/button';

/**
 * Frontière d'erreur du tableau de bord (Phase 06.8) — message sobre si une
 * agrégation échoue de façon catastrophique, sans stack trace (CLAUDE.md § 6).
 */
export default function TableauDeBordError({
  reset,
}: {
  error: Error;
  reset: () => void;
}): JSX.Element {
  return (
    <div className="space-y-12 rounded-lg border border-dashed p-48 text-center">
      <p className="text-foreground font-medium">
        Le tableau de bord est momentanément indisponible.
      </p>
      <p className="text-muted-foreground mx-auto max-w-md text-sm">
        Réessayez dans un instant. Si le problème persiste, contactez le support.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
