import { redirect } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { UserMenu as UserMenuClient } from './user-menu.client';

/**
 * Wrapper RSC du menu utilisateur — récupère le profil côté serveur et le
 * passe en props au client. Évite le double round-trip vs un fetch client.
 *
 * En cas d'absence de session (incohérence avec le layout guard), redirige
 * vers /login plutôt que d'afficher un menu vide.
 */
export async function UserMenu(): Promise<JSX.Element> {
  const ctx = await getAuthContext();
  if (!ctx) {
    redirect('/login');
  }
  return (
    <UserMenuClient
      prenom={ctx.profile.prenom}
      nom={ctx.profile.nom}
      email={ctx.profile.email}
      role={ctx.profile.role}
    />
  );
}
