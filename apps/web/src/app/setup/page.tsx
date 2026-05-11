/**
 * /setup — page d'initialisation de la base
 *
 * Affichée après que l'intégration Vercel ↔ Supabase ait posé les env vars
 * (POSTGRES_URL_NON_POOLING + NEXT_PUBLIC_SUPABASE_URL + ANON_KEY). À ce stade
 * les tables n'existent pas encore — un bouton lance le setup en 1 clic.
 *
 * Détection à chaque rendu (force-dynamic) : si la DB est déjà peuplée, on
 * redirige vers /login.
 */

import { redirect } from 'next/navigation';
import { checkDatabaseReady } from './actions';
import { InitButton } from './init-button.client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Initialisation — TAP Régulation',
};

export default async function SetupPage() {
  const { ready, reason } = await checkDatabaseReady();

  if (ready) {
    redirect('/login');
  }

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseConfigured) {
    redirect('/welcome');
  }

  return (
    <main className="min-h-screen flex items-start justify-center px-24 py-48 bg-background">
      <div className="w-full max-w-[560px] space-y-32">
        <header className="space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            TAP Régulation
          </h1>
          <p className="text-muted-foreground">
            SaaS de régulation pour sociétés de Transport Assis Professionnalisé à La Réunion.
          </p>
        </header>

        <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-24 space-y-8">
          <p className="font-medium text-foreground">Plus qu&apos;une étape</p>
          <p className="text-sm text-muted-foreground">
            L&apos;intégration Vercel ↔ Supabase est en place. Il reste à
            initialiser la base avec le schéma et les données démo. Un seul
            clic.
          </p>
        </section>

        <div className="rounded-md border border-border bg-card p-24 space-y-16">
          <div className="space-y-8">
            <h2 className="text-base font-medium text-foreground">
              Initialiser la base de données
            </h2>
            <p className="text-sm text-muted-foreground">
              Crée les tables nécessaires (patients, courses, RGPD…) et insère
              les comptes démo :
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside marker:text-muted-foreground/50 font-mono">
              <li>dirigeant@demo.tap</li>
              <li>regulateur@demo.tap</li>
              <li>chauffeur@demo.tap</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Plus 10 patients fictifs réunionnais pour tester la recherche et
              la saisie de course. Mot de passe partagé : <code className="font-mono text-foreground">demo1234!</code>
            </p>
          </div>

          <InitButton />

          <p className="text-xs text-muted-foreground">
            L&apos;opération est idempotente — peut être relancée sans risque
            de doublons.
          </p>
        </div>

        {reason && (
          <details className="rounded-md border border-border bg-muted/20 p-12 text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Détails techniques
            </summary>
            <pre className="pt-8 text-muted-foreground font-mono whitespace-pre-wrap break-all">
              {reason}
            </pre>
          </details>
        )}
      </div>
    </main>
  );
}
