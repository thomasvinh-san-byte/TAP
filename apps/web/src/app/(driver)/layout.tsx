import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { UserMenu } from '@/components/user-menu';
import { SWRegister } from './_components/sw-register.client';

/**
 * Layout authentifié — shell chauffeur (CLAUDE.md § 5 PWA chauffeur).
 *
 * Variante minimale du shell régulateur :
 *   - Pas d'onglets (le chauffeur n'a qu'une page principale /conduite).
 *   - Pas de RideExpressOrchestrator ni de DraftQueue (création de course
 *     réservée à la régulatrice).
 *   - Tint chaud très subtil sur le <main> pour ancrer visuellement le
 *     contexte « mode chauffeur » sans saturer.
 *
 * Guard serveur (defense in depth — CLAUDE.md § 6, complète RLS Postgres) :
 *   - sans session : redirect /login
 *   - rôle non chauffeur : redirect /patients (zone chauffeur réservée)
 */
export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  if (ctx.role !== 'chauffeur') redirect('/patients');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SWRegister />
      <header
        className={
          'sticky top-0 z-40 h-14 w-full border-b border-border ' +
          'bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70'
        }
      >
        <div className="h-full px-16 sm:px-24 flex items-center justify-between gap-16">
          <Link
            href="/conduite"
            className="flex items-baseline gap-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <span className="font-semibold text-foreground tracking-tight">
              TAP
            </span>
            <span className="text-sm text-muted-foreground">Ma journée</span>
          </Link>
          <UserMenu />
        </div>
      </header>
      <main
        className="flex-1 px-16 sm:px-24 py-24 max-w-[640px] w-full mx-auto"
        style={{ backgroundColor: 'hsl(var(--driver-surface, var(--background)))' }}
      >
        {children}
      </main>
    </div>
  );
}
