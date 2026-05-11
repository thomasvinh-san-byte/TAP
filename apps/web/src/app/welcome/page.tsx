/**
 * Welcome — page de bienvenue quand les env vars Supabase manquent.
 *
 * Une seule étape utilisateur : installer l'intégration Vercel ↔ Supabase
 * via le Marketplace (3 clics). Une fois les env vars posées, le
 * middleware redirige automatiquement vers /setup qui propose un bouton
 * « Initialiser la base avec données démo » (encore 1 clic).
 *
 * Total : 2 actions utilisateur, ~30 secondes.
 *
 * Page statique pure — pas d'import Supabase, pas d'auth, pas de DB.
 */

const REPO = 'thomasvinh-san-byte/tap';
const VERCEL_MARKETPLACE = 'https://vercel.com/marketplace/supabase';

export default function WelcomePage() {
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
          <p className="font-medium text-foreground">Une seule étape pour démarrer</p>
          <p className="text-sm text-muted-foreground">
            Connecter Vercel à Supabase via le Marketplace. Aucun copier-coller,
            aucun secret à créer, aucun fichier à toucher.
          </p>
        </section>

        <div className="rounded-md border border-border bg-card p-24 space-y-16">
          <h2 className="text-base font-medium text-foreground">
            Installer l&apos;intégration Vercel ↔ Supabase
          </h2>
          <ol className="text-sm text-muted-foreground space-y-4 list-decimal list-inside marker:text-muted-foreground/50">
            <li>
              Cliquer le bouton ci-dessous
            </li>
            <li>
              Cliquer <em>Add Integration</em> en haut à droite
            </li>
            <li>Sélectionner le projet Vercel <strong>tap-web</strong></li>
            <li>Sélectionner le projet Supabase</li>
            <li>
              Cliquer <em>Add Integration</em> pour valider
            </li>
          </ol>
          <a
            href={VERCEL_MARKETPLACE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full h-48 px-24 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Ouvrir le Marketplace Vercel →
          </a>
          <p className="text-xs text-muted-foreground">
            Vercel pose les variables d&apos;environnement Supabase et
            redéploie l&apos;app automatiquement. À l&apos;issue, cette page
            se transforme en bouton « Initialiser la base » — encore 1 clic
            et tu pourras te connecter.
          </p>
        </div>

        <footer className="space-y-8 text-xs text-muted-foreground">
          <p>
            <a
              href={`https://github.com/${REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Repo GitHub →
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}

export const dynamic = 'force-static';
