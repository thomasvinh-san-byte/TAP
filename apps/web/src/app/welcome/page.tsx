/**
 * Welcome — page de bienvenue quand les env vars Supabase manquent.
 *
 * Filet d'affichage tant que la connexion Supabase n'est pas configurée dans
 * l'environnement d'hébergement. Message d'onboarding neutre (indépendant de
 * l'hébergeur). Une fois les variables posées, le middleware redirige vers
 * /setup puis /login.
 *
 * Refonte Phase 04 (PLAN-4 §4.6) : consomme `<AuthShell>` mode jour.
 * Page statique pure — pas d'import Supabase, pas d'auth, pas de DB.
 */

import { AuthShell } from '../(auth)/_components/auth-shell';

const REPO = 'thomasvinh-san-byte/tap';

export default function WelcomePage() {
  return (
    <AuthShell title="Configurer l'environnement">
      <div className="space-y-24">
        <p className="text-muted-foreground text-sm leading-[1.5]">
          SaaS de régulation pour sociétés de Transport Assis Professionnalisé à La Réunion.
        </p>

        <section className="border-border bg-muted/40 space-y-8 rounded-md border p-16">
          <p className="text-foreground text-sm font-medium">Connexion Supabase non configurée</p>
          <p className="text-muted-foreground text-sm">
            Les variables d&apos;environnement Supabase ne sont pas encore disponibles sur cet
            environnement. Une fois renseignées, l&apos;application poursuit automatiquement vers
            l&apos;initialisation puis la connexion.
          </p>
        </section>

        <div className="border-border bg-card space-y-16 rounded-md border p-16">
          <h2 className="text-foreground text-base font-medium">Variables à définir</h2>
          <p className="text-muted-foreground text-sm">
            Renseigner, dans la configuration de l&apos;environnement d&apos;hébergement, les
            variables de connexion Supabase :
          </p>
          <ul className="text-muted-foreground marker:text-muted-foreground/50 list-inside list-disc space-y-4 font-mono text-xs">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
            <li>DATABASE_URL</li>
          </ul>
          <p className="text-muted-foreground text-xs">
            Dès que ces variables sont présentes, cette page laisse place à l&apos;étape suivante
            (initialisation puis connexion). Voir <code>.env.example</code> pour la liste complète.
          </p>
        </div>

        <footer className="text-muted-foreground text-xs">
          <a
            href={`https://github.com/${REPO}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground underline underline-offset-4"
          >
            Repo GitHub
          </a>
        </footer>
      </div>
    </AuthShell>
  );
}

export const dynamic = 'force-static';
