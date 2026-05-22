import { notFound } from 'next/navigation';
import { DevSwitcher } from './dev-switcher.client';

export const metadata = { title: 'Mode démo' };
export const dynamic = 'force-dynamic';

/**
 * Page /dev — outils de bascule de session démo (Phase 3 / 03-G).
 *
 * Affichée uniquement quand `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true` (flag
 * Phase 0.7 utilisé aussi pour révéler les comptes démo sur /login). En
 * production commerciale → notFound() (zéro fuite, zéro fallback custom).
 */
export default function DevPage() {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'true') {
    notFound();
  }
  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-24">
      <div className="w-full max-w-[480px] space-y-24">
        <header className="space-y-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Mode démo</h1>
          <p className="text-muted-foreground text-sm">Choisissez un compte de démonstration.</p>
        </header>
        <DevSwitcher />
      </div>
    </div>
  );
}
