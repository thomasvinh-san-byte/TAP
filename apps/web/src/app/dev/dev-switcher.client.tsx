'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { loginAsDemoAction, type SwitchState } from './actions';

/**
 * Switcher de session démo (Phase 3 / 03-G).
 *
 * Pattern miroir `LoginForm` Phase 0.7 :
 *   useFormState pour les erreurs de Server Action sans navigation,
 *   useFormStatus pour le feedback pending du bouton (< 100 ms perçu).
 *
 * Trois cards verticales empilées (dirigeant / régulateur / chauffeur).
 * Aucun nom propre (regle-neutralite-et-ton.md § 1) — chaque compte
 * est identifié par son rôle + email du seed démo.
 */

interface DemoAccount {
  role: 'dirigeant' | 'regulateur' | 'chauffeur';
  roleLabel: string;
  email: string;
  password: string;
  redirectTo: string;
}

const ACCOUNTS: ReadonlyArray<DemoAccount> = [
  {
    role: 'dirigeant',
    roleLabel: 'Dirigeant',
    email: 'dirigeant@demo.tap',
    password: 'demo1234!',
    redirectTo: '/patients',
  },
  {
    role: 'regulateur',
    roleLabel: 'Régulateur',
    email: 'regulateur@demo.tap',
    password: 'demo1234!',
    redirectTo: '/patients',
  },
  {
    role: 'chauffeur',
    roleLabel: 'Chauffeur',
    email: 'chauffeur@demo.tap',
    password: 'demo1234!',
    redirectTo: '/conduite',
  },
];

const initialState: SwitchState = {};

function SubmitButton(): JSX.Element {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="default"
      disabled={pending}
      aria-busy={pending}
      className="w-full h-12 justify-center gap-8"
    >
      <LogIn className="h-16 w-16" aria-hidden />
      <span>{pending ? 'Connexion…' : 'Ouvrir la session'}</span>
    </Button>
  );
}

function AccountCard({ acc }: { acc: DemoAccount }): JSX.Element {
  const [state, formAction] = useFormState(loginAsDemoAction, initialState);
  return (
    <form
      action={formAction}
      className="flex flex-col gap-12 rounded-md border border-border bg-background p-16 shadow-sm"
    >
      <div className="flex items-center gap-12">
        <InitialsAvatar
          name={acc.roleLabel}
          role={acc.role}
          size={48}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{acc.roleLabel}</p>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {acc.email}
          </p>
        </div>
      </div>
      <input type="hidden" name="email" value={acc.email} />
      <input type="hidden" name="password" value={acc.password} />
      <input type="hidden" name="redirectTo" value={acc.redirectTo} />
      <SubmitButton />
      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="text-xs text-destructive"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function DevSwitcher(): JSX.Element {
  return (
    <div className="flex flex-col gap-16">
      {ACCOUNTS.map((acc) => (
        <AccountCard key={acc.email} acc={acc} />
      ))}
    </div>
  );
}
