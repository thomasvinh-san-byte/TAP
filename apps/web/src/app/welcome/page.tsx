/**
 * Welcome — page de fallback affichée quand les env vars Supabase manquent.
 *
 * Page statique pure (pas d'import Supabase, pas d'auth, pas de DB) pour que
 * la preview Vercel affiche QUELQUE CHOSE même si la config est incomplète,
 * au lieu d'un 500 MIDDLEWARE_INVOCATION_FAILED brutal.
 *
 * Affiche le pas-à-pas exact pour finaliser la configuration côté Vercel.
 * Les noms des écrans/boutons sont les noms réels en anglais (Vercel UI 2026)
 * pour que l'utilisateur les retrouve sans ambiguïté.
 *
 * Une fois NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY posées
 * dans Vercel, le middleware ne redirige plus vers cette page — elle reste
 * accessible directement via /welcome.
 */

const VERCEL_PROJECT = 'tap-web';
const VERCEL_TEAM = 'tvss-projects-07aa3591';
const PROJECT_BASE = `https://vercel.com/${VERCEL_TEAM}/${VERCEL_PROJECT}`;

const STEPS = [
  {
    n: 1,
    title: 'Connect Supabase via Marketplace',
    href: 'https://vercel.com/marketplace/supabase',
    instructions: [
      'Ouvrir le lien ci-dessous',
      'Cliquer Add Integration en haut à droite',
      'Sélectionner le Vercel team contenant tap-web',
      'Sélectionner le Vercel project tap-web',
      'Sélectionner le Supabase project (vkanxnhipsitpnhkdsae)',
      'Cliquer Add Integration pour finaliser',
    ],
    cta: 'Open Marketplace → Supabase',
  },
  {
    n: 2,
    title: 'Verify Environment Variables',
    href: `${PROJECT_BASE}/settings/environment-variables`,
    instructions: [
      "Sur l'écran Environment Variables, vérifier la présence de :",
      '• NEXT_PUBLIC_SUPABASE_URL',
      '• NEXT_PUBLIC_SUPABASE_ANON_KEY',
      "Si absentes : retourner étape 1 (l'integration n'a pas été finalisée)",
    ],
    cta: 'Open Settings → Environment Variables',
  },
  {
    n: 3,
    title: 'Trigger a Redeployment',
    href: `${PROJECT_BASE}/deployments`,
    instructions: [
      'Repérer le deployment le plus récent (en haut de la liste)',
      'Cliquer le bouton ⋯ (More options) à droite de la ligne',
      'Cliquer Redeploy',
      'Dans le dialog : décocher Use existing Build Cache',
      'Cliquer le bouton Redeploy bleu',
    ],
    cta: 'Open Deployments',
  },
] as const;

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
          <p className="font-medium text-foreground">Setup required</p>
          <p className="text-sm text-muted-foreground">
            Les variables Supabase ne sont pas encore disponibles sur ce déploiement.
            3 étapes côté Vercel pour finaliser. Les noms de menu/boutons ci-dessous
            sont ceux de l&apos;UI Vercel en anglais.
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
                <div className="flex-1 space-y-12">
                  <h2 className="text-base font-medium text-foreground">
                    {step.title}
                  </h2>
                  <ul className="text-sm text-muted-foreground space-y-4 list-disc list-inside marker:text-muted-foreground/50">
                    {step.instructions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
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
            au profit de l&apos;écran de connexion (le middleware détecte les variables
            au prochain déploiement).
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
