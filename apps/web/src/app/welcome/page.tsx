/**
 * Welcome — page de fallback affichée quand les env vars Supabase manquent.
 *
 * Approche minimale : 2 actions, pas de configuration GitHub Actions.
 *
 * Étape 1 — Coller le SQL dans Supabase Studio (peuple la DB)
 * Étape 2 — Installer l'integration Vercel-Supabase (pose les env vars + redeploy)
 *
 * Total : 2 copier-coller de liens, 5 minutes.
 *
 * Page statique pure (pas d'import Supabase, pas d'auth, pas de DB).
 */

const REPO = 'thomasvinh-san-byte/tap';
const SUPABASE_PROJECT_REF = 'vkanxnhipsitpnhkdsae';

const SETUP_SQL_URL = `https://github.com/${REPO}/blob/main/supabase/setup-all.sql`;
const SETUP_SQL_RAW = `https://raw.githubusercontent.com/${REPO}/main/supabase/setup-all.sql`;
const SUPABASE_SQL_EDITOR = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}/sql/new`;
const VERCEL_MARKETPLACE = 'https://vercel.com/marketplace/supabase';

export default function WelcomePage() {
  return (
    <main className="min-h-screen flex items-start justify-center px-24 py-48 bg-background">
      <div className="w-full max-w-[680px] space-y-32">
        <header className="space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            TAP Régulation
          </h1>
          <p className="text-muted-foreground">
            SaaS de régulation pour sociétés de Transport Assis Professionnalisé à La Réunion.
          </p>
        </header>

        <section className="rounded-md border border-amber-500/40 bg-amber-500/5 p-24 space-y-8">
          <p className="font-medium text-foreground">2 étapes pour démarrer (5 minutes)</p>
          <p className="text-sm text-muted-foreground">
            Aucun fichier à modifier. Aucun secret à créer. Juste 2 onglets à
            ouvrir.
          </p>
        </section>

        <ol className="space-y-16">
          <li className="rounded-md border border-border bg-card p-24 space-y-12">
            <div className="flex items-start gap-12">
              <span className="flex-none flex items-center justify-center h-32 w-32 rounded-full bg-primary/10 text-primary text-sm font-semibold tabular-nums">
                1
              </span>
              <div className="flex-1 space-y-12">
                <h2 className="text-base font-medium text-foreground">
                  Peupler la base Supabase
                </h2>
                <ol className="text-sm text-muted-foreground space-y-4 list-decimal list-inside marker:text-muted-foreground/50">
                  <li>
                    Ouvrir{' '}
                    <a
                      href={SETUP_SQL_RAW}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4 hover:no-underline"
                    >
                      le fichier SQL complet
                    </a>{' '}
                    sur GitHub
                  </li>
                  <li>Sélectionner tout le contenu (Cmd/Ctrl+A) puis copier (Cmd/Ctrl+C)</li>
                  <li>
                    Ouvrir{' '}
                    <a
                      href={SUPABASE_SQL_EDITOR}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4 hover:no-underline"
                    >
                      Supabase SQL Editor
                    </a>{' '}
                    (nouvelle requête)
                  </li>
                  <li>Coller le SQL (Cmd/Ctrl+V)</li>
                  <li>
                    Cliquer le bouton vert <em>Run</em> en bas à droite
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Crée toutes les tables, le compte régulatrice démo, et 10 patients fictifs
                  réunionnais. Idempotent — sans risque de casser quoi que ce soit.
                </p>
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
                  Connecter Vercel à Supabase
                </h2>
                <ol className="text-sm text-muted-foreground space-y-4 list-decimal list-inside marker:text-muted-foreground/50">
                  <li>
                    Ouvrir{' '}
                    <a
                      href={VERCEL_MARKETPLACE}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-4 hover:no-underline"
                    >
                      Vercel Marketplace — Supabase
                    </a>
                  </li>
                  <li>
                    Cliquer <em>Add Integration</em>
                  </li>
                  <li>Sélectionner le projet Vercel <strong>tap-web</strong></li>
                  <li>
                    Sélectionner le projet Supabase{' '}
                    <code className="font-mono text-foreground">{SUPABASE_PROJECT_REF}</code>
                  </li>
                  <li>
                    Cliquer <em>Add Integration</em> pour terminer
                  </li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  Vercel pose automatiquement les clés Supabase et redéploie l&apos;app.
                  Aucun copier-coller de clés à faire.
                </p>
              </div>
            </div>
          </li>
        </ol>

        <section className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-24 space-y-8">
          <p className="font-medium text-foreground">Après ces 2 étapes</p>
          <p className="text-sm text-muted-foreground">
            Attendre ~2 minutes que Vercel finisse de redéployer. La page se
            transforme en formulaire de connexion. Login avec :
          </p>
          <ul className="text-sm text-muted-foreground font-mono space-y-2 list-disc list-inside">
            <li>
              <strong>regulateur@demo.tap</strong> / <strong>demo1234!</strong>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            Tu verras la liste des 10 patients seedés. Cmd+Shift+K ouvre le modal
            de saisie express.
          </p>
        </section>

        <details className="rounded-md border border-border bg-muted/20 p-16 text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Configuration avancée (rotation secrets, app secrets NIR/JWT)
          </summary>
          <div className="pt-12 space-y-8 text-xs text-muted-foreground">
            <p>
              Pour les features qui nécessitent du chiffrement (NIR patient, JWT
              portail RGPD) :{' '}
              <a
                href={`https://github.com/${REPO}/actions/workflows/setup-vercel.yml`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                workflow GitHub Actions
              </a>{' '}
              dédié — à lancer une fois quand on testera ces parcours.
            </p>
            <p>
              Pour la rotation des secrets :{' '}
              <a
                href={`https://github.com/${REPO}/blob/main/.planning/phases/00.7-deploiement-vercel/0.7-SUMMARY.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-foreground"
              >
                doc Phase 0.7
              </a>
              .
            </p>
          </div>
        </details>

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
