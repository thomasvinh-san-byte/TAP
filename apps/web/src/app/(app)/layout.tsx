import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { AppHeader } from '@/components/app-header';
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

  return (
    <Providers>
      <RideExpressOrchestrator>
        <div className="bg-background flex min-h-screen flex-col">
          <AppHeader role={ctx.role as 'dirigeant' | 'regulateur'} extras={<DraftQueue />} />
          <main className="mx-auto w-full max-w-[1280px] flex-1 px-24 py-24">{children}</main>
        </div>
      </RideExpressOrchestrator>
    </Providers>
  );
}
