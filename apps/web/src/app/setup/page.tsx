/**
 * /setup — page d'initialisation de la base
 *
 * Affichée après que l'intégration Vercel ↔ Supabase ait posé les env vars
 * (POSTGRES_URL_NON_POOLING + NEXT_PUBLIC_SUPABASE_URL + ANON_KEY). À ce stade
 * les tables n'existent pas encore — un bouton lance le setup en 1 clic.
 *
 * Détection à chaque rendu (force-dynamic) : si la DB est déjà peuplée, on
 * redirige vers /login.
 *
 * Refonte Phase 04 (PLAN-4 §4.6) : consomme `<AuthShell>` mode jour.
 */

import { redirect } from 'next/navigation';
import { AuthShell } from '../(auth)/_components/auth-shell.client';
import { checkDatabaseState } from './actions';
import { InitButton } from './init-button.client';

export const dynamic = 'force-dynamic';

// Init DB ~30-90s sur Free plan Supabase → besoin de plus que le 10s Hobby
// par défaut. Hobby tier supporte jusqu'à 60s en preview, Pro jusqu'à 300s.
export const maxDuration = 60;

export const metadata = {
  title: 'Initialisation — TAP Régulation',
};

export default async function SetupPage() {
  const { state, reason } = await checkDatabaseState();

  if (state === 'ready') {
    redirect('/login');
  }

  const isPartial = state === 'partial';

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseConfigured) {
    redirect('/welcome');
  }

  return (
    <AuthShell title="Initialiser la base">
      <div className="space-y-24">
        <section className="rounded-md border border-border bg-muted/40 p-16 space-y-8">
          <p className="font-medium text-foreground text-sm">
            {isPartial ? 'Init incomplète détectée' : "Plus qu'une étape"}
          </p>
          <p className="text-sm text-muted-foreground">
            {isPartial
              ? "Les tables existent mais les comptes démo manquent (probable échec partiel d'une init précédente). Cliquer pour (re)créer les comptes : le seed est idempotent."
              : "L'intégration Vercel ↔ Supabase est en place. Il reste à initialiser la base avec le schéma et les données démo. Un seul clic."}
          </p>
        </section>

        <div className="rounded-md border border-border bg-card p-16 space-y-16">
          <div className="space-y-8">
            <h2 className="text-base font-medium text-foreground">
              Initialiser la base de données
            </h2>
            <p className="text-sm text-muted-foreground">
              Crée les tables nécessaires (patients, courses, RGPD…) et
              insère les comptes démo :
            </p>
            <ul className="text-sm text-muted-foreground space-y-4 list-disc list-inside marker:text-muted-foreground/50 font-mono">
              <li>dirigeant@demo.tap</li>
              <li>regulateur@demo.tap</li>
              <li>chauffeur@demo.tap</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Plus 10 patients fictifs réunionnais pour tester la recherche et
              la saisie de course. Mot de passe partagé :{' '}
              <code className="font-mono text-foreground">demo1234!</code>
            </p>
          </div>

          <InitButton />

          <p className="text-xs text-muted-foreground">
            L&apos;opération est idempotente : peut être relancée sans risque
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
    </AuthShell>
  );
}
