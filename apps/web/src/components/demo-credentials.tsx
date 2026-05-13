'use client';

/**
 * DemoCredentials — cards cliquables qui pré-remplissent le LoginForm (C07).
 *
 * Visible UNIQUEMENT si `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === '1'`.
 * Sinon le composant retourne `null` (ABSENT du DOM — pas `display:none`).
 * Empêche fuite credentials en prod via inspecteur (Q5.1, threat model).
 *
 * DEC-031 : étendu à 5 cards (dirigeant + régulateur + 3 chauffeurs nommés)
 * pour permettre l'UAT multi-chauffeurs sans devoir taper les emails.
 *
 * Lift state up : le parent `<LoginFormShell>` détient l'état `prefill` et
 * passe la callback `onSelect(email, password)`. RHF re-sync via `setValue`
 * dans le `useEffect` du LoginForm.
 *
 * Style : `hover:bg-accent/8` + `active:bg-accent/12` (UI-SPEC § 7.7).
 * Échelle accent réservée à ces cards uniquement (NFR-004).
 */

import { ChevronRight } from 'lucide-react';

type Account = {
  role: string;
  description: string;
  email: string;
  password: string;
  permis?: string;
};

const ADMINS: ReadonlyArray<Account> = [
  {
    role: 'Dirigeant — Mme Hoarau',
    description: 'Accès complet, pilotage, configuration.',
    email: 'dirigeant@demo.tap',
    password: 'demo1234!',
  },
  {
    role: 'Régulateur — Mme Payet',
    description: 'Saisie des courses, affectation, caisse.',
    email: 'regulateur@demo.tap',
    password: 'demo1234!',
  },
];

const DRIVERS: ReadonlyArray<Account> = [
  {
    role: 'Vergoz Jean',
    description: 'PWA mobile, courses du jour, clôture.',
    email: 'chauffeur@demo.tap',
    password: 'demo1234!',
    permis: 'taxi',
  },
  {
    role: 'Maillot André',
    description: 'PWA mobile, courses du jour, clôture.',
    email: 'chauffeur2@demo.tap',
    password: 'demo1234!',
    permis: 'taxi',
  },
  {
    role: 'Boyer Sophie',
    description: 'PWA mobile, courses du jour, clôture.',
    email: 'chauffeur3@demo.tap',
    password: 'demo1234!',
    permis: 'taxi + TPMR',
  },
];

interface DemoCredentialsProps {
  onSelect: (email: string, password: string) => void;
}

export function DemoCredentials({ onSelect }: DemoCredentialsProps) {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== '1') return null;

  return (
    <div className="space-y-12">
      <p className="text-sm text-muted-foreground">
        Comptes de démonstration (cliquer pour pré-remplir).
      </p>

      <div className="space-y-8">
        {ADMINS.map((account) => (
          <AccountCard
            key={account.email}
            account={account}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="space-y-8">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Chauffeurs ({DRIVERS.length})
        </p>
        {DRIVERS.map((account) => (
          <AccountCard
            key={account.email}
            account={account}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onSelect,
}: {
  account: Account;
  onSelect: (email: string, password: string) => void;
}) {
  return (
    <button
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
          <p className="text-xs text-muted-foreground">{account.description}</p>
          {account.permis ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              Permis : {account.permis}
            </p>
          ) : null}
        </div>
        <ChevronRight
          className="h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}
