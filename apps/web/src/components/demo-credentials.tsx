'use client';

/**
 * DemoCredentials — 3 cards cliquables qui pré-remplissent le LoginForm (C07).
 *
 * Visible UNIQUEMENT si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`.
 * Sinon le composant retourne `null` (ABSENT du DOM — pas `display:none`).
 * Empêche fuite credentials en prod via inspecteur (Q5.1, threat model).
 *
 * Lift state up : le parent `<LoginFormShell>` détient l'état `prefill` et
 * passe la callback `onSelect(email, password)`. RHF re-sync via `setValue`
 * dans le `useEffect` du LoginForm.
 *
 * Style : `hover:bg-accent/8` + `active:bg-accent/12` (UI-SPEC § 7.7).
 * Échelle accent réservée à ces cards uniquement (NFR-004).
 */

import { ChevronRight } from 'lucide-react';

const ACCOUNTS = [
  {
    role: 'Dirigeant',
    description: 'Accès complet, pilotage, configuration.',
    email: 'dirigeant@demo.tap',
    password: 'demo1234!',
  },
  {
    role: 'Régulateur',
    description: 'Saisie des courses, affectation, caisse.',
    email: 'regulateur@demo.tap',
    password: 'demo1234!',
  },
  {
    role: 'Chauffeur',
    description: 'PWA mobile, courses du jour, clôture.',
    email: 'chauffeur@demo.tap',
    password: 'demo1234!',
  },
] as const;

interface DemoCredentialsProps {
  onSelect: (email: string, password: string) => void;
}

export function DemoCredentials({ onSelect }: DemoCredentialsProps) {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1') return null;

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Comptes de démonstration (cliquer pour pré-remplir).
      </p>
      <div className="space-y-8">
        {ACCOUNTS.map((account) => (
          <button
            key={account.email}
            type="button"
            onClick={() => onSelect(account.email, account.password)}
            className="
              w-full text-left
              border border-border rounded-md p-16
              cursor-pointer
              hover:bg-accent/8 hover:border-accent
              active:bg-accent/12
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2
            "
          >
            <div className="flex items-center justify-between">
              <div className="space-y-4">
                <p className="text-sm font-medium">{account.role}</p>
                <p className="text-xs text-muted-foreground">
                  {account.description}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
