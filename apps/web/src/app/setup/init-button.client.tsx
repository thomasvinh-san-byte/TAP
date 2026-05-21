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
        className="bg-primary text-primary-foreground hover:bg-primary/90 h-48 w-full rounded-md px-24 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? 'Initialisation en cours…'
          : result?.ok
            ? '✓ Initialisé'
            : 'Initialiser la base avec données démo'}
      </button>

      {result?.ok === true && (
        <div className="space-y-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-12 text-sm">
          <p className="text-foreground font-medium">{result.message}</p>
          <p className="text-muted-foreground text-xs">Redirection vers la page de connexion…</p>
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
