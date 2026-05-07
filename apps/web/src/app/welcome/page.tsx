/**
 * Welcome — page de fallback affichée quand les env vars Supabase manquent.
 *
 * Au lieu d'envoyer l'utilisateur fouiller dans Vercel UI + Supabase UI,
 * deux workflows GitHub Actions automatisent tout :
 *   1. setup-vercel.yml (manuel, 1 fois) — config Vercel env vars + Supabase
 *      Edge Function secrets + redeploy
 *   2. cd.yml (auto sur push main) — applique migrations + seed démo +
 *      déploie Edge Functions Supabase
 *
 * L'utilisateur fait 2 actions une seule fois :
 *   1. Ajouter 6 secrets dans GitHub Actions (1 page, copier-coller)
 *   2. Cliquer Run workflow sur setup-vercel.yml (1 clic)
 *
 * Tout le reste tourne automatiquement à chaque push sur main.
 *
 * Page statique pure (pas d'import Supabase, pas d'auth, pas de DB) pour que
 * la preview Vercel s'affiche même sans config.
 */

const REPO = 'thomasvinh-san-byte/tap';
const SECRETS_URL = `https://github.com/${REPO}/settings/secrets/actions/new`;
const WORKFLOW_URL = `https://github.com/${REPO}/actions/workflows/setup-vercel.yml`;

const SECRETS = [
  {
    name: 'SUPABASE_ACCESS_TOKEN',
    where: 'https://supabase.com/dashboard/account/tokens',
    hint: 'Generate new token → name "tap-deploy"',
  },
  {
    name: 'SUPABASE_PROJECT_REF',
    where: 'URL Supabase du projet',
    hint: 'La partie XXX dans https://XXX.supabase.co',
  },
  {
    name: 'SUPABASE_DB_PASSWORD',
    where: 'Le mot de passe DB choisi à la création du projet Supabase',
    hint: "Si oublié : Supabase → Settings → Database → Reset database password",
  },
  {
    name: 'VERCEL_TOKEN',
    where: 'https://vercel.com/account/tokens',
    hint: 'Create Token → scope Full Account, expire 30+ jours',
  },
  {
    name: 'VERCEL_PROJECT_ID',
    where: 'Vercel → tap-web → Settings → General',
    hint: 'Section "Project ID" en bas (commence par prj_)',
  },
  {
    name: 'VERCEL_TEAM_ID',
    where: 'Vercel → Team Settings → General',
    hint: 'Section "Team ID" (commence par team_)',
  },
] as const;

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex items-start justify-center px-24 py-48 bg-background">
      <div className="w-full max-w-[760px] space-y-32">
        <header className="space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            TAP Régulation
          </h1>
          <p className="text-muted-foreground">
            SaaS de régulation pour sociétés de Transport Assis Professionnalisé à La Réunion.
          </p>
        </header>

        <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-24 space-y-8">
          <p className="font-medium text-foreground">Setup automatisé en 2 étapes</p>
          <p className="text-sm text-muted-foreground">
            Deux workflows GitHub Actions configurent Vercel + Supabase
            (env vars, migrations, seed démo, Edge Functions, redeploy) sans
            cliquer dans aucune UI Vercel ou Supabase.
          </p>
        </section>

        <ol className="space-y-16">
          <li className="rounded-md border border-border bg-card p-24 space-y-16">
            <div className="flex items-start gap-12">
              <span className="flex-none flex items-center justify-center h-32 w-32 rounded-full bg-primary/10 text-primary text-sm font-semibold tabular-nums">
                1
              </span>
              <div className="flex-1 space-y-12">
                <h2 className="text-base font-medium text-foreground">
                  Ajouter 6 secrets GitHub Actions
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ouvrir le lien ci-dessous, cliquer <em>New repository secret</em>{' '}
                  pour chaque ligne, copier-coller la valeur.
                </p>
                <div className="overflow-hidden rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-8 font-medium text-foreground">Name</th>
                        <th className="text-left p-8 font-medium text-foreground">Where to find</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {SECRETS.map((s) => (
                        <tr key={s.name}>
                          <td className="p-8 font-mono text-foreground align-top whitespace-nowrap">
                            {s.name}
                          </td>
                          <td className="p-8 text-muted-foreground space-y-4">
                            <div>{s.where}</div>
                            <div className="text-foreground/60">{s.hint}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <a
                  href={SECRETS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-4 text-sm text-primary underline underline-offset-4 hover:no-underline"
                >
                  Open GitHub → New repository secret →
                </a>
              </div>
            </div>
          </li>

          <li className="rounded-md border border-border bg-card p-24 space-y-12">
            <div className="flex items-start gap-12">
              <span className="flex-none flex items-center justify-center h-32 w-32 rounded-full bg-primary/10 text-primary text-sm font-semibold tabular-nums">
                2
              </span>
              <div className="flex-1 space-y-12">
                <h2 className="text-base font-medium text-foreground">
                  Lancer &laquo; Setup Vercel + Supabase &raquo;
                </h2>
                <ul className="text-sm text-muted-foreground space-y-4 list-disc list-inside marker:text-muted-foreground/50">
                  <li>Sur la page workflow, cliquer <em>Run workflow</em> en haut à droite</li>
                  <li>Laisser <em>Use workflow from: main</em></li>
                  <li>Laisser <em>regenerate_app_secrets: false</em></li>
                  <li>Cliquer le bouton vert <em>Run workflow</em></li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Le workflow met ~30 sec : récupère Supabase keys, génère 4
                  app secrets (NIR/JWT/salt), push 8 env vars dans Vercel,
                  push 2 secrets dans Supabase Edge Functions, déclenche
                  redeploy Vercel.
                </p>
                <a
                  href={WORKFLOW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-4 text-sm text-primary underline underline-offset-4 hover:no-underline"
                >
                  Open GitHub Actions → Setup Vercel + Supabase →
                </a>
              </div>
            </div>
          </li>
        </ol>

        <section className="rounded-md border border-border bg-muted/20 p-24 space-y-8">
          <p className="text-sm font-medium text-foreground">
            Et le code Supabase (migrations, seed, Edge Functions) ?
          </p>
          <p className="text-xs text-muted-foreground">
            Tout passe par <code className="font-mono">cd.yml</code> qui se
            déclenche automatiquement sur chaque push sur la branche{' '}
            <code className="font-mono">main</code> :
          </p>
          <ul className="text-xs text-muted-foreground space-y-2 list-disc list-inside">
            <li>Applique les 8 migrations Supabase</li>
            <li>Applique le seed (3 comptes démo + 10 patients fictifs réunionnais)</li>
            <li>Déploie l&apos;Edge Function <code className="font-mono">nir</code> (chiffrement)</li>
            <li>Build et déploie le front Next.js sur Vercel production</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Aucun clic supplémentaire. Push code = tout se met à jour.
          </p>
        </section>

        <footer className="space-y-8 text-xs text-muted-foreground">
          <p>
            Une fois les 2 étapes faites, attendre ~2 min que Vercel finisse
            le redeploy. Cette page disparaîtra automatiquement au profit de
            l&apos;écran de connexion.
          </p>
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
