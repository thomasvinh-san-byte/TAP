import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppHeader } from '@/components/app-header';
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
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const profile = profileRes.data as { role: string } | null;
  const role = profile?.role;

  if (role !== 'dirigeant' && role !== 'regulateur') {
    redirect('/');
  }

  return (
    <Providers>
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader role={role} />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-24 py-24">{children}</main>
      </div>
    </Providers>
  );
}
