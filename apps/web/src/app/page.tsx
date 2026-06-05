import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Racine de l'application — redirection par rôle (DEC-071).
 *
 * Chaque rôle atterrit sur sa page d'accueil : dirigeant → tableau de bord,
 * régulateur → cockpit, chauffeur → conduite.
 */
export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profileRes.data as { role: string | null } | null)?.role;

  if (role === 'dirigeant') redirect('/tableau-de-bord');
  if (role === 'regulateur') redirect('/cockpit');
  if (role === 'chauffeur') redirect('/conduite');
  redirect('/login');
}
