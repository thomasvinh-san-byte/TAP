/**
 * Welcome — page de fallback affichée quand les env vars Supabase manquent.
 *
 * Pas d'import Supabase, pas d'auth, pas de DB. Page statique pure pour que
 * la preview Vercel affiche QUELQUE CHOSE même si la config est incomplète,
 * au lieu d'un 500 MIDDLEWARE_INVOCATION_FAILED brutal.
 *
 * En production avec env vars correctement posées, le middleware ne redirige
 * plus jamais ici — cette page reste accessible pour qui tape /welcome
 * directement (page de présentation produit légère, V1).
 */

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-24 bg-background">
      <div className="max-w-[640px] space-y-32 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          TAP Régulation
        </h1>
        <p className="text-muted-foreground">
          SaaS de régulation pour sociétés de Transport Assis Professionnalisé
          à La Réunion.
        </p>
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-24 text-left text-sm text-muted-foreground space-y-12">
          <p className="font-medium text-foreground">
            Configuration en cours
          </p>
          <p>
            L&apos;application est déployée mais les variables d&apos;environnement
            Supabase ne sont pas encore disponibles. Une fois la configuration
            terminée, la page de connexion sera accessible.
          </p>
          <p>
            <a
              href="https://github.com/thomasvinh-san-byte/tap"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Repo GitHub →
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

export const dynamic = 'force-static';
