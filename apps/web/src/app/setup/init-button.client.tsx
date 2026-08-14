'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { initializeDatabase, type SetupResult } from './actions';

interface Props {
  /** Libellé du bouton au repos. Défaut : première init. */
  label?: string;
  /**
   * Base déjà « prête » (comptes présents) : on RECHARGE le seed sans rediriger
   * automatiquement (le régulateur reste sur /setup pour relancer si besoin).
   */
  reload?: boolean;
}

export function InitButton({ label, reload = false }: Props = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SetupResult | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await initializeDatabase();
      setResult(res);
      // Après un rechargement (base déjà prête), on ne redirige PAS d'office :
      // le régulateur peut vouloir relancer ou vérifier. Sinon, redirection login.
      if (res.ok && !reload) {
        setTimeout(() => router.push('/login'), 1500);
      }
    });
  }

  const idleLabel = label ?? 'Initialiser la base avec données démo';
  return (
    <div className="space-y-12">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || (result?.ok === true && !reload)}
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-48 w-full rounded-md px-24 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? reload
            ? 'Rechargement en cours…'
            : 'Initialisation en cours…'
          : result?.ok && !reload
            ? '✓ Initialisé'
            : idleLabel}
      </button>

      {result?.ok === true && (
        <div className="space-y-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-12 text-sm">
          <p className="text-foreground font-medium">{result.message}</p>
          <p className="text-muted-foreground text-xs">
            {reload ? (
              <a href="/login" className="underline">
                Aller à la connexion
              </a>
            ) : (
              'Redirection vers la page de connexion…'
            )}
          </p>
        </div>
      )}

      {result?.ok === false && (
        <div className="border-destructive/40 bg-destructive/5 space-y-4 rounded-md border p-12 text-sm">
          <p className="text-foreground font-medium">Erreur</p>
          <p className="text-muted-foreground break-all font-mono text-xs">{result.error}</p>
        </div>
      )}
    </div>
  );
}
