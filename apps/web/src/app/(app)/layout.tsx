import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Providers } from './providers.client';
import { RideExpressOrchestrator } from './courses/_components/ride-express-orchestrator.client';
import { HeaderNewRideButton } from './courses/_components/header-new-ride-button.client';
import { DraftQueue } from './courses/_components/draft-queue.client';

/**
 * Layout authentifié — enveloppe toutes les routes du groupe (app).
 *
 * Garde-fou serveur en complément du middleware (ceinture + bretelles) :
 * un Server Component sans cookie valide redirige vers /login. Utilise
 * getUser() côté serveur (jamais getSession() — cf. ADR sécurité).
 *
 * Phase 2 / Wave 4 :
 * - Monte `<RideExpressOrchestrator>` qui écoute Cmd/Ctrl+Shift+K et
 *   expose `dispatch` via Context aux enfants (D-03 modal global).
 * - Header global : bouton « + Nouvelle course » + DraftQueue dropdown.
 * - Lien navigation `/courses`.
 */
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
        <div className="min-h-screen flex flex-col">
          <header className="border-b px-24 py-12 flex items-center justify-between gap-16">
            <Link
              href="/patients"
              className="font-semibold text-foreground tracking-tight"
            >
              TAP Régulation
            </Link>
            <nav className="flex gap-16 text-sm text-muted-foreground items-center">
              <Link
                href="/patients"
                className="hover:text-foreground transition-colors"
              >
                Patients
              </Link>
              <Link
                href="/courses"
                className="hover:text-foreground transition-colors"
              >
                Courses
              </Link>
              <DraftQueue />
              <HeaderNewRideButton />
            </nav>
          </header>
          <main className="flex-1 px-24 py-24 max-w-[1280px] w-full mx-auto">
            {children}
          </main>
        </div>
      </RideExpressOrchestrator>
    </Providers>
  );
}
