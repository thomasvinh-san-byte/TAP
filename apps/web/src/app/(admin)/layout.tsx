import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NavTabs } from '@/components/nav-tabs.client';
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
  const supabase = createClient();
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

  // Hotfix 04.7-bis élargi (UX) : layout admin réutilise le même shell que
  // (app)/layout.tsx (header sticky + NavTabs + UserMenu) pour cohérence
  // visuelle. Les régulateurs/dirigeants ne voient plus deux apps
  // disjointes (« TAP Régulation » vs « TAP Administration »). La nav
  // principale Patients/Courses/Caisse/Chauffeurs reste accessible
  // depuis n'importe quelle page admin.
  //
  // Le déplacement physique des routes /admin/* → / serait plus propre
  // long terme (cohérence URL) mais nécessite un audit + refactor tests
  // hors scope hotfix-bis : reporté Phase 06 HDS (audit RLS systémique
  // + restructuration routes).
  const BASE_TABS = [
    { href: '/patients', label: 'Patients' },
    { href: '/courses', label: 'Courses' },
    { href: '/courses/caisse', label: 'Caisse' },
    { href: '/admin/chauffeurs', label: 'Chauffeurs' },
  ];
  const ADMIN_EXTRAS = [
    { href: '/admin/vehicules', label: 'Véhicules' },
    { href: '/admin/tarifs', label: 'Tarifs' },
    { href: '/admin/legal/registre', label: 'Registre' },
    { href: '/admin/legal/breaches', label: 'Violations' },
  ];
  const tabs = isDirigeant ? [...BASE_TABS, ...ADMIN_EXTRAS] : BASE_TABS;

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
            <NavTabs tabs={tabs} />
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
