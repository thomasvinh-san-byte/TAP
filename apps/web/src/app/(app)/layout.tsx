import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NavTabs } from '@/components/nav-tabs.client';
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
 * Guard serveur ceinture+bretelles du middleware : un Server Component
 * sans cookie valide redirige vers /login (getUser, jamais getSession).
 */
const APP_TABS = [
  { href: '/patients', label: 'Patients' },
  { href: '/courses', label: 'Courses' },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <Providers>
      <RideExpressOrchestrator>
        <div className="min-h-screen flex flex-col bg-background">
          <header
            className={
              'sticky top-0 z-40 h-14 w-full border-b border-border ' +
              'bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70'
            }
          >
            <div className="h-full px-24 flex items-center justify-between gap-24">
              <Link
                href="/patients"
                className="flex items-baseline gap-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <span className="font-semibold text-foreground tracking-tight">
                  TAP
                </span>
                <span className="text-sm text-muted-foreground">
                  Régulation
                </span>
              </Link>
              <NavTabs tabs={APP_TABS} />
              <div className="flex items-center gap-16">
                <DraftQueue />
                <UserMenu />
              </div>
            </div>
          </header>
          <main className="flex-1 px-24 py-24 max-w-[1280px] w-full mx-auto">
            {children}
          </main>
        </div>
      </RideExpressOrchestrator>
    </Providers>
  );
}
