/**
 * Welcome — page de fallback affichée quand les env vars Supabase manquent.
 *
 * Page statique pure (pas d'import Supabase, pas d'auth, pas de DB) pour que
 * la preview Vercel affiche QUELQUE CHOSE même si la config est incomplète,
 * au lieu d'un 500 MIDDLEWARE_INVOCATION_FAILED brutal.
 *
 * Affiche la checklist exacte à suivre pour finaliser la config.
 *
 * Une fois NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY posées
 * dans Vercel, le middleware ne redirige plus vers cette page — elle reste
 * accessible directement via /welcome.
 */

const STEPS = [
  {
    n: 1,
    title: 'Installer l’intégration Vercel ↔ Supabase',
    body: 'Pose automatiquement les 4 variables Supabase requises (URL, anon key, service_role, JWT secret) sur le projet Vercel.',
    cta: 'Ouvrir Vercel Marketplace',
    href: 'https://vercel.com/integrations/supabase',
  },
  {
    n: 2,
    title: 'Vérifier que les variables sont bien posées',
    body: 'Ouvrir Settings → Environment Variables et confirmer que NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY apparaissent (Production + Preview).',
    cta: 'Ouvrir Vercel Settings',
    href: 'https://vercel.com/tvss-projects-07aa3591/tap-web/settings/environment-variables',
  },
  {
    n: 3,
    title: 'Redéployer',
    body: 'Vercel ne re-build pas automatiquement après ajout de variables. Cliquer Redeploy sur le dernier déploiement (décocher « Use existing Build Cache »).',
    cta: 'Ouvrir Deployments',
    href: 'https://vercel.com/tvss-projects-07aa3591/tap-web/deployments',
  },
] as const;

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex items-start justify-center px-24 py-48 bg-background">
      <div className="w-full max-w-[640px] space-y-32">
        <header className="space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            TAP Régulation
          </h1>
          <p className="text-muted-foreground">
            SaaS de régulation pour sociétés de Transport Assis Professionnalisé à La Réunion.
          </p>
        </header>

        <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-24 space-y-8">
          <p className="font-medium text-foreground">Configuration requise</p>
          <p className="text-sm text-muted-foreground">
            Les variables d&apos;environnement Supabase ne sont pas encore disponibles
            sur ce déploiement. Suivre les 3 étapes ci-dessous pour finaliser.
          </p>
        </section>

        <ol className="space-y-16">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="rounded-md border border-border bg-card p-24 space-y-12"
            >
              <div className="flex items-start gap-12">
                <span className="flex-none flex items-center justify-center h-32 w-32 rounded-full bg-primary/10 text-primary text-sm font-semibold tabular-nums">
                  {step.n}
                </span>
                <div className="flex-1 space-y-8">
                  <h2 className="text-base font-medium text-foreground">
                    {step.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                  <a
                    href={step.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-4 text-sm text-primary underline underline-offset-4 hover:no-underline"
                  >
                    {step.cta} →
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ol>

        <footer className="space-y-8 text-xs text-muted-foreground">
          <p>
            Une fois les 3 étapes faites, cette page disparaîtra automatiquement
            au profit de l&apos;écran de connexion.
          </p>
          <p>
            <a
              href="https://github.com/thomasvinh-san-byte/tap"
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
