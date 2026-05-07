/**
 * Welcome — page de fallback affichée quand les env vars Supabase manquent.
 *
 * Au lieu d'envoyer l'utilisateur fouiller dans Vercel UI (4-5 écrans à
 * naviguer), un workflow GitHub Actions automatise tout :
 *   1. User ajoute 5 secrets dans GitHub Settings (1 page, copier-coller)
 *   2. User déclenche le workflow "Setup Vercel" (1 clic)
 *   3. Workflow récupère les credentials Supabase, génère les secrets app,
 *      pousse les 8 env vars dans Vercel, et trigger un redeploy.
 *
 * Total clics utilisateur : ~6 (5 secrets + 1 trigger).
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
    hint: 'Generate new token → name "tap-vercel-setup"',
  },
  {
    name: 'SUPABASE_PROJECT_REF',
    where: 'URL Supabase Dashboard du projet',
    hint: 'La partie XXX dans https://XXX.supabase.co (ex: vkanxnhipsitpnhkdsae)',
  },
  {
    name: 'VERCEL_TOKEN',
    where: 'https://vercel.com/account/tokens',
    hint: 'Create Token → scope Full Account, expire 30 jours',
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
      <div className="w-full max-w-[720px] space-y-32">
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
            Plutôt que de cliquer dans 4 écrans Vercel, ce projet utilise un workflow
            GitHub Actions qui configure tout automatiquement. Total clics : ~6.
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
                  Ajouter 5 secrets GitHub Actions
                </h2>
                <p className="text-sm text-muted-foreground">
                  Ouvrir le lien ci-dessous, cliquer <em>New repository secret</em>{' '}
                  pour chaque ligne, copier-coller la valeur récupérée à la source
                  indiquée.
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
                  Lancer le workflow &laquo; Setup Vercel &raquo;
                </h2>
                <ul className="text-sm text-muted-foreground space-y-4 list-disc list-inside marker:text-muted-foreground/50">
                  <li>Sur la page workflow ci-dessous, cliquer <em>Run workflow</em> en haut à droite</li>
                  <li>Laisser <em>Use workflow from: main</em></li>
                  <li>Laisser <em>regenerate_app_secrets: false</em></li>
                  <li>Cliquer le bouton vert <em>Run workflow</em></li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Le workflow met ~30 sec : récupère les Supabase keys via API, génère
                  les 4 secrets app (NIR, JWT legal, anonymization), pousse les 8 env
                  vars dans Vercel, déclenche un redeploy.
                </p>
                <a
                  href={WORKFLOW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-4 text-sm text-primary underline underline-offset-4 hover:no-underline"
                >
                  Open GitHub Actions → Setup Vercel →
                </a>
              </div>
            </div>
          </li>
        </ol>

        <footer className="space-y-8 text-xs text-muted-foreground">
          <p>
            Une fois le workflow vert, attendre ~2 min que Vercel finisse le redeploy.
            Cette page disparaîtra automatiquement au profit de l&apos;écran de connexion.
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
