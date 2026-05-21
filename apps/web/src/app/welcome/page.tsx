/**
 * Welcome — page de bienvenue quand les env vars Supabase manquent.
 *
 * Une seule étape utilisateur : installer l'intégration Vercel ↔ Supabase
 * via le Marketplace (3 clics). Une fois les env vars posées, le
 * middleware redirige automatiquement vers /setup qui propose un bouton
 * « Initialiser la base avec données démo » (encore 1 clic).
 *
 * Refonte Phase 04 (PLAN-4 §4.6) : consomme `<AuthShell>` mode jour.
 * Page statique pure — pas d'import Supabase, pas d'auth, pas de DB.
 */

import { AuthShell } from '../(auth)/_components/auth-shell.client';

const REPO = 'thomasvinh-san-byte/tap';
const VERCEL_MARKETPLACE = 'https://vercel.com/marketplace/supabase';

export default function WelcomePage() {
  return (
    <AuthShell title="Configurer l'environnement">
      <div className="space-y-24">
        <p className="text-muted-foreground text-sm leading-[1.5]">
          SaaS de régulation pour sociétés de Transport Assis Professionnalisé à La Réunion.
        </p>

        <section className="border-border bg-muted/40 space-y-8 rounded-md border p-16">
          <p className="text-foreground text-sm font-medium">Une seule étape pour démarrer</p>
          <p className="text-muted-foreground text-sm">
            Connecter Vercel à Supabase via le Marketplace. Aucun copier-coller, aucun secret à
            créer, aucun fichier à toucher.
          </p>
        </section>

        <div className="border-border bg-card space-y-16 rounded-md border p-16">
          <h2 className="text-foreground text-base font-medium">
            Installer l&apos;intégration Vercel ↔ Supabase
          </h2>
          <ol className="text-muted-foreground marker:text-muted-foreground/50 list-inside list-decimal space-y-4 text-sm">
            <li>Cliquer le bouton ci-dessous</li>
            <li>
              Cliquer <em>Add Integration</em> en haut à droite
            </li>
            <li>
              Sélectionner le projet Vercel <strong>tap-web</strong>
            </li>
            <li>Sélectionner le projet Supabase</li>
            <li>
              Cliquer <em>Add Integration</em> pour valider
            </li>
          </ol>
          <a
            href={VERCEL_MARKETPLACE}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex h-12 w-full items-center justify-center rounded-md px-16 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            Ouvrir le Marketplace Vercel
          </a>
          <p className="text-muted-foreground text-xs">
            Vercel pose les variables d&apos;environnement Supabase et redéploie l&apos;app
            automatiquement. À l&apos;issue, cette page se transforme en bouton « Initialiser la
            base » : encore 1 clic et la connexion sera possible.
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
