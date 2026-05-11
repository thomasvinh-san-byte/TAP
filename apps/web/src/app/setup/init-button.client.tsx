'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { initializeDatabase, type SetupResult } from './actions';

export function InitButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SetupResult | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await initializeDatabase();
      setResult(res);
      if (res.ok) {
        // Laisse 1s pour lire le message puis redirige
        setTimeout(() => router.push('/login'), 1500);
      }
    });
  }

  return (
    <div className="space-y-12">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || result?.ok === true}
        className="w-full h-48 px-24 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {pending
          ? 'Initialisation en cours…'
          : result?.ok
            ? '✓ Initialisé'
            : 'Initialiser la base avec données démo'}
      </button>

      {result?.ok === true && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-12 text-sm space-y-4">
          <p className="font-medium text-foreground">{result.message}</p>
          <p className="text-muted-foreground text-xs">
            Redirection vers la page de connexion…
          </p>
        </div>
      )}

      {result?.ok === false && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-12 text-sm space-y-4">
          <p className="font-medium text-foreground">Erreur</p>
          <p className="text-muted-foreground text-xs font-mono break-all">
            {result.error}
          </p>
        </div>
      )}
    </div>
  );
}
