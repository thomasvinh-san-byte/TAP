import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Providers } from '@/app/(app)/providers.client';

/**
 * Layout admin (D-16) — guard SSR rôle dirigeant uniquement.
 * Double rideau avec RLS Postgres (D-18) : si l'utilisateur n'est
 * pas dirigeant la base refuse aussi la lecture/écriture.
 *
 * Redirige vers /login si non auth, vers / si rôle insuffisant.
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

  if (profile?.role !== 'dirigeant') {
    redirect('/');
  }

  return (
    <Providers>
      <div className="min-h-screen flex flex-col bg-background">
        <header className="border-b px-24 py-12 flex items-center justify-between">
          <Link href="/admin" className="font-semibold tracking-tight">
            TAP Administration
          </Link>
          <nav className="flex gap-16 text-sm text-muted-foreground">
            <Link href="/admin/legal/registre" className="hover:text-foreground">
              Registre
            </Link>
            <Link href="/admin/legal/breaches" className="hover:text-foreground">
              Violations
            </Link>
          </nav>
        </header>
        <main className="flex-1 max-w-[1200px] mx-auto px-24 py-32 w-full">
          {children}
        </main>
      </div>
    </Providers>
  );
}
