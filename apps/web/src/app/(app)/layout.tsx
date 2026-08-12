import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { AppHeader } from '@/components/app-header';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MessagingButton } from '@/components/messaging/messaging-button.client';
import { isMessagingEnabled } from '@/lib/release-flags';
import { Providers } from './providers.client';
import { RideExpressOrchestrator } from './courses/_components/ride-express-orchestrator.client';

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

  // Messagerie interne (§5.22) — LIVRÉE : ON par défaut (kill-switch
  // MESSAGING_ENABLED=false). Évaluée côté serveur, haut dans la pile, de façon
  // uniforme via `isMessagingEnabled` (même sémantique que /messagerie).
  const messagingEnabled = isMessagingEnabled();

  return (
    <Providers>
      <TooltipProvider delayDuration={400}>
        <RideExpressOrchestrator>
          <div className="bg-background flex min-h-screen flex-col">
            <AppHeader
              role={ctx.role as 'dirigeant' | 'regulateur'}
              extras={messagingEnabled ? <MessagingButton /> : undefined}
            />
            <main className="mx-auto w-full max-w-[1280px] flex-1 px-24 py-24">{children}</main>
          </div>
        </RideExpressOrchestrator>
      </TooltipProvider>
    </Providers>
  );
}
