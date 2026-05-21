import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { tabsForRole } from '@/lib/nav-config';
import { NavTabs } from '@/components/nav-tabs.client';
import { LegalNavMenu } from '@/components/legal-nav-menu.client';
import { UserMenu } from '@/components/user-menu';
import { Providers } from './providers.client';
import { RideExpressOrchestrator } from './courses/_components/ride-express-orchestrator.client';
import { DraftQueue } from './courses/_components/draft-queue.client';

/**
 * Layout authentifié — shell régulateur (CLAUDE.md § 1 pilier 1).
 *
 * Header sticky 56px, 3 zones (logo / tabs / actions+user). Le bouton
 * « + Nouvelle course » global a été retiré du shell (03-C) — la création
 * de course se fait par Cmd+Shift+K (raccourci global, orchestrator monté
 * ici) ou via un CTA contextuel dans la page /courses (03-D).
 *
 * Guard serveur (defense in depth — CLAUDE.md § 6, complète RLS Postgres) :
 *   - sans session : redirect /login
 *   - rôle chauffeur : redirect /conduite (zone régulateur interdite)
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  if (ctx.role === 'chauffeur') redirect('/conduite');

  // Nav unifiée par rôle (lib/nav-config.ts) — identique sur (app) et (admin).
  const tabs = tabsForRole(ctx.role);
  const isDirigeant = ctx.role === 'dirigeant';

  return (
    <Providers>
      <RideExpressOrchestrator>
        <div className="bg-background flex min-h-screen flex-col">
          <header
            className={
              'border-border sticky top-0 z-40 h-14 w-full border-b ' +
              'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur'
            }
          >
            <div className="flex h-full items-center justify-between gap-24 px-24">
              <Link
                href="/patients"
                className="focus-visible:ring-ring flex items-baseline gap-8 rounded-sm focus-visible:outline-none focus-visible:ring-2"
              >
                <span className="text-foreground font-semibold tracking-tight">TAP</span>
                <span className="text-muted-foreground text-sm">Régulation</span>
              </Link>
              <div className="flex h-full items-center gap-32">
                <NavTabs tabs={tabs} />
                {isDirigeant && <LegalNavMenu />}
              </div>
              <div className="flex items-center gap-16">
                <DraftQueue />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-24 py-24">{children}</main>
        </div>
      </RideExpressOrchestrator>
    </Providers>
  );
}
