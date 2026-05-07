/**
 * DemoCredentials — affiche les comptes de démo SEULEMENT en preview/staging.
 *
 * Activation via env var `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true`.
 * En production commerciale, l'env var doit être absente ou = `false` —
 * sinon les comptes démo sont visibles publiquement (fuite d'identifiants).
 *
 * Le composant est un Server Component (pas d'interactivité, pas de state).
 */

const ACCOUNTS = [
  { role: 'Dirigeant', email: 'dirigeant@demo.tap', icon: '◉' },
  { role: 'Régulatrice', email: 'regulateur@demo.tap', icon: '◉' },
  { role: 'Chauffeur', email: 'chauffeur@demo.tap', icon: '◉' },
] as const;

export function DemoCredentials() {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'true') {
    return null;
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/40 p-12 text-xs space-y-8">
      <p className="font-medium text-foreground">
        Environnement de démonstration
      </p>
      <p className="text-muted-foreground">
        Mot de passe partagé : <code className="font-mono text-foreground">demo1234!</code>
      </p>
      <ul className="space-y-4">
        {ACCOUNTS.map((account) => (
          <li key={account.email} className="flex items-center justify-between gap-8">
            <span className="text-muted-foreground">{account.role}</span>
            <code className="font-mono text-foreground tabular-nums">
              {account.email}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}
