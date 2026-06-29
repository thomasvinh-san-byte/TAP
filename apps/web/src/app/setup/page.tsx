/**
 * /setup — page d'initialisation de la base
 *
 * Affichée quand les env vars Supabase sont posées mais la base est vide.
 * À ce stade les tables n'existent pas encore — un bouton lance le setup démo
 * en 1 clic, UNIQUEMENT si `DEMO_SETUP_ENABLED=true` (outil dev/démo). En prod
 * HDS (toggle OFF), le bouton n'est pas rendu : la base est provisionnée par
 * l'équipe (OVH-05).
 *
 * Détection à chaque rendu (force-dynamic) : si la DB est déjà peuplée, on
 * redirige vers /login.
 *
 * Refonte Phase 04 (PLAN-4 §4.6) : consomme `<AuthShell>` mode jour.
 */

import { redirect } from 'next/navigation';
import { AuthShell } from '../(auth)/_components/auth-shell';
import { checkDatabaseState } from './actions';
import { InitButton } from './init-button.client';

export const dynamic = 'force-dynamic';

// Init DB ~30-90s sur Free plan Supabase → besoin de plus que le 10s Hobby
// par défaut. Hobby tier supporte jusqu'à 60s en preview, Pro jusqu'à 300s.
export const maxDuration = 60;

export const metadata = {
  title: 'Initialisation',
};

export default async function SetupPage() {
  const { state, reason } = await checkDatabaseState();

  if (state === 'ready') {
    redirect('/login');
  }

  const isPartial = state === 'partial';

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseConfigured) {
    redirect('/welcome');
  }

  // OVH-05 — l'init self-service est un outil dev/démo (OFF par défaut). En prod
  // HDS, le bouton n'est pas rendu (le verrou réel est côté action serveur).
  const demoSetupEnabled = process.env.DEMO_SETUP_ENABLED === 'true';

  return (
    <AuthShell title="Initialiser la base">
      <div className="space-y-24">
        <section className="border-border bg-muted/40 space-y-8 rounded-md border p-16">
          <p className="text-foreground text-sm font-medium">
            {isPartial ? 'Init incomplète détectée' : "Plus qu'une étape"}
          </p>
          <p className="text-muted-foreground text-sm">
            {isPartial
              ? "Les tables existent mais les comptes démo manquent (probable échec partiel d'une init précédente). Cliquer pour (re)créer les comptes : le seed est idempotent."
              : 'La connexion Supabase est en place. Il reste à initialiser la base avec le schéma et les données démo.'}
          </p>
        </section>

        {demoSetupEnabled ? (
          <div className="border-border bg-card space-y-16 rounded-md border p-16">
            <div className="space-y-8">
              <h2 className="text-foreground text-base font-medium">
                Initialiser la base de données
              </h2>
              <p className="text-muted-foreground text-sm">
                Crée les tables nécessaires (patients, courses, RGPD…) et insère les comptes démo :
              </p>
              <ul className="text-muted-foreground marker:text-muted-foreground/50 list-inside list-disc space-y-4 font-mono text-sm">
                <li>dirigeant@demo.tap</li>
                <li>regulateur@demo.tap</li>
                <li>chauffeur@demo.tap</li>
              </ul>
              <p className="text-muted-foreground text-sm">
                Plus 10 patients fictifs réunionnais pour tester la recherche et la saisie de
                course. Mot de passe partagé :{' '}
                <code className="text-foreground font-mono">demo1234!</code>
              </p>
            </div>

            <InitButton />

            <p className="text-muted-foreground text-xs">
              L&apos;opération est idempotente : peut être relancée sans risque de doublons.
            </p>
          </div>
        ) : (
          <div className="border-border bg-card space-y-8 rounded-md border p-16">
            <h2 className="text-foreground text-base font-medium">
              Initialisation self-service désactivée
            </h2>
            <p className="text-muted-foreground text-sm">
              Sur cet environnement, la base est provisionnée et migrée par l&apos;équipe.
              L&apos;init avec données de démo n&apos;est pas disponible ici.
            </p>
          </div>
        )}

        {reason && (
          <details className="border-border bg-muted/20 rounded-md border p-12 text-xs">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
              Détails techniques
            </summary>
            <pre className="text-muted-foreground whitespace-pre-wrap break-all pt-8 font-mono">
              {reason}
            </pre>
          </details>
        )}
      </div>
    </AuthShell>
  );
}
