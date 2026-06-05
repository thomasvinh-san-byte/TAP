import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { tabsForRole } from '@/lib/nav-config';
import { NavTabs } from '@/components/nav-tabs.client';
import { LegalNavMenu } from '@/components/legal-nav-menu.client';
import { UserMenu } from '@/components/user-menu';
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

  const isDirigeant = role === 'dirigeant';

  // Nav unifiée par rôle (lib/nav-config.ts) — identique sur (app) et (admin) :
  // la barre dépend du rôle, jamais de la page. Le régulateur garde le Cockpit
  // et n'a pas les outils admin ; le dirigeant a tout + « Légal ▾ ». Les 6
  // pages RGPD restent regroupées dans le sous-menu <LegalNavMenu />.
  //
  // Les routes /admin/* ne sont pas déplacées vers / — refactor reporté
  // (cohérence URL, audit + tests) : seule la liste d'onglets est unifiée.
  const tabs = tabsForRole(role);

  return (
    <Providers>
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
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-24 py-24">{children}</main>
      </div>
    </Providers>
  );
}
