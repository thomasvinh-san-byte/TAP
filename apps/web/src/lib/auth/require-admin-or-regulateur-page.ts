import { redirect } from 'next/navigation';
import { getAuthContext, type AuthContext } from './get-auth-context';

/**
 * Guard SSR pour les pages Server Components accessibles aux rôles
 * `dirigeant` ET `regulateur` (ex : `/courses/caisse`, DEC-043).
 *
 * Pattern miroir de `requireDirigeantPage` (Phase 1.5) mais élargi
 * au régulateur. Chauffeur reçoit un redirect vers `/conduite`.
 *
 * Refs : DEC-029 esprit, DEC-043 LOCKED (RLS caisse).
 */
export async function requireAdminOrRegulateurPage(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  if (ctx.role === 'chauffeur') redirect('/conduite');
  if (ctx.role !== 'dirigeant' && ctx.role !== 'regulateur') {
    redirect('/login');
  }
  return ctx;
}
