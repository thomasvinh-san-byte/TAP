import { notFound } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { loginAsDemoAction } from './actions';

export const metadata = { title: 'Mode démo — TAP' };
export const dynamic = 'force-dynamic';

/**
 * Page /dev — switch de session démo (Phase 3 / 03-G).
 *
 * Trois cartes côte-à-côte (dirigeant / régulateur / chauffeur). Chaque
 * carte = un formulaire qui dispatche `loginAsDemoAction` avec email +
 * password + redirectTo hardcodés.
 *
 * Guard env : la page est masquée en production commerciale via 404 sauf
 * si `NEXT_PUBLIC_DEMO_MODE=true`. Aucun header app, aucun nav — c'est un
 * outil de développement séparé du shell utilisateur.
 */

interface DemoAccount {
  role: 'dirigeant' | 'regulateur' | 'chauffeur';
  roleLabel: string;
  displayName: string;
  email: string;
  password: string;
  redirectTo: string;
}

const ACCOUNTS: ReadonlyArray<DemoAccount> = [
  {
    role: 'dirigeant',
    roleLabel: 'Dirigeant',
    displayName: 'Compte dirigeant',
    email: 'dirigeant@demo.tap',
    password: 'demo1234!',
    redirectTo: '/patients',
  },
  {
    role: 'regulateur',
    roleLabel: 'Régulatrice',
    displayName: 'Compte régulateur',
    email: 'regulateur@demo.tap',
    password: 'demo1234!',
    redirectTo: '/patients',
  },
  {
    role: 'chauffeur',
    roleLabel: 'Chauffeur',
    displayName: 'Compte chauffeur',
    email: 'chauffeur@demo.tap',
    password: 'demo1234!',
    redirectTo: '/conduite',
  },
];

export default function DevPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
  ) {
    notFound();
  }

  const errorMessage = searchParams.error?.trim();

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-[960px] items-center justify-between px-24 py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mode démo
            </p>
            <h1 className="text-lg font-semibold tracking-tight">
              Outils de développement
            </h1>
          </div>
          <span className="text-xs text-muted-foreground">
            Basculer entre les comptes démo
          </span>
        </div>
      </div>

      <main className="mx-auto max-w-[960px] px-24 py-48">
        <p className="mb-24 text-sm text-muted-foreground">
          Sélectionner un compte démo pour ouvrir une session. La session
          courante est terminée avant la nouvelle connexion.
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="mb-24 rounded-md border border-destructive/40 bg-destructive/10 px-16 py-12 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3">
          {ACCOUNTS.map((acc) => (
            <article
              key={acc.email}
              className="flex flex-col gap-16 rounded-md border border-border bg-background p-24 shadow-sm"
            >
              <div className="flex items-center gap-12">
                <InitialsAvatar
                  name={acc.displayName}
                  role={acc.role}
                  size={48}
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{acc.roleLabel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {acc.email}
                  </p>
                </div>
              </div>
              <form action={loginAsDemoAction} className="mt-auto">
                <input type="hidden" name="email" value={acc.email} />
                <input type="hidden" name="password" value={acc.password} />
                <input
                  type="hidden"
                  name="redirectTo"
                  value={acc.redirectTo}
                />
                <Button type="submit" className="w-full gap-8">
                  <LogIn className="h-16 w-16" aria-hidden />
                  Ouvrir la session
                </Button>
              </form>
            </article>
          ))}
        </div>

        <p className="mt-32 text-xs text-muted-foreground">
          Cette page n'est accessible qu'en environnement de démonstration
          (variable `NEXT_PUBLIC_DEMO_MODE`).
        </p>
      </main>
    </div>
  );
}
