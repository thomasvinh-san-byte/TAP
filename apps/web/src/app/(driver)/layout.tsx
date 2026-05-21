import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { UserMenu } from '@/components/user-menu';
import { SWRegister } from './_components/sw-register.client';
import { ConnectionStatusBadge } from './_components/connection-status-badge.client';
import { WarningBannerInactivity } from './_components/warning-banner-inactivity.client';
import { InstallPwaBanner } from './_components/install-pwa-banner.client';

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
export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  if (ctx.role !== 'chauffeur') redirect('/patients');

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <SWRegister />
      <header
        className={
          'pt-safe border-border sticky top-0 z-40 w-full border-b ' +
          'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur'
        }
      >
        <div className="flex h-14 items-center justify-between gap-16 px-16 sm:px-24">
          <Link
            href="/conduite"
            className="focus-visible:ring-ring flex items-baseline gap-8 rounded-sm focus-visible:outline-none focus-visible:ring-2"
          >
            <span className="text-foreground font-semibold tracking-tight">TAP</span>
            <span className="text-muted-foreground text-sm">Ma journée</span>
          </Link>
          <div className="flex items-center gap-12">
            <ConnectionStatusBadge />
            <UserMenu />
          </div>
        </div>
      </header>
      <main
        className="pb-safe mx-auto w-full max-w-[640px] flex-1 px-16 py-24 sm:px-24"
        style={{ backgroundColor: 'hsl(var(--driver-surface, var(--background)))' }}
      >
        <WarningBannerInactivity />
        <InstallPwaBanner />
        {children}
      </main>
    </div>
  );
}
