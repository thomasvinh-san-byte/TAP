import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Providers } from './providers.client';

/**
 * Layout authentifié — enveloppe toutes les routes du groupe (app).
 *
 * Garde-fou serveur en complément du middleware (ceinture + bretelles) :
 * un Server Component sans cookie valide redirige vers /login. Utilise
 * getUser() côté serveur (jamais getSession() — cf. ADR sécurité).
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
      <div className="min-h-screen flex flex-col">
        <header className="border-b px-24 py-12 flex items-center justify-between">
          <Link
            href="/patients"
            className="font-semibold text-foreground tracking-tight"
          >
            TAP Régulation
          </Link>
          <nav className="flex gap-16 text-sm text-muted-foreground">
            <Link
              href="/patients"
              className="hover:text-foreground transition-colors"
            >
              Patients
            </Link>
          </nav>
        </header>
        <main className="flex-1 px-24 py-24 max-w-[1280px] w-full mx-auto">
          {children}
        </main>
      </div>
    </Providers>
  );
}
