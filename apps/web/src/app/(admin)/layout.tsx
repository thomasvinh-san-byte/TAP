import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Providers } from '@/app/(app)/providers.client';

/**
 * Layout admin (D-16) — guard SSR rôles `dirigeant` OU `regulateur`.
 *
 * Phase 04 hotfix (DEC-029) : le régulateur est élargi à `/admin/chauffeurs`
 * (gestion opérationnelle quotidienne — embauche, invitation, archivage).
 * Les autres pages admin (vehicules, legal/*) restent dirigeant-only via
 * `requireDirigeantPage()` en tête de chaque page Server Component
 * (`apps/web/src/lib/auth/require-dirigeant-page.ts`).
 *
 * Double rideau avec RLS Postgres : les policies `drivers_*` et
 * `driver_invitations_*` autorisent désormais les deux rôles (migration
 * `20260516000001_drivers_perm_regulateur.sql`). Les autres tables
 * (vehicules, organisations, etc.) gardent leur RLS dirigeant-only —
 * un régulateur qui forcerait l'URL `/admin/vehicules` est redirigé
 * vers `/admin/chauffeurs` avant d'atteindre la requête BDD.
 *
 * Redirige vers /login si non auth, vers / si rôle ni dirigeant ni régulateur.
 */
export default async function AdminLayout({
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

  const profileRes = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { role: string } | null;
  const role = profile?.role;

  if (role !== 'dirigeant' && role !== 'regulateur') {
    redirect('/');
  }

  const isDirigeant = role === 'dirigeant';

  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b px-24 py-12 flex items-center justify-between">
          <Link href="/admin/chauffeurs" className="font-semibold tracking-tight">
            TAP Administration
          </Link>
          <nav className="flex gap-16 text-sm text-muted-foreground">
            <Link href="/admin/chauffeurs" className="hover:text-foreground">
              Chauffeurs
            </Link>
            {isDirigeant ? (
              <>
                <Link href="/admin/vehicules" className="hover:text-foreground">
                  Véhicules
                </Link>
                <Link
                  href="/admin/legal/registre"
                  className="hover:text-foreground"
                >
                  Registre
                </Link>
                <Link
                  href="/admin/legal/breaches"
                  className="hover:text-foreground"
                >
                  Violations
                </Link>
              </>
            ) : null}
          </nav>
        </header>
        <main className="flex-1 max-w-[1200px] mx-auto px-24 py-32 w-full">
          {children}
        </main>
      </div>
    </Providers>
  );
}
