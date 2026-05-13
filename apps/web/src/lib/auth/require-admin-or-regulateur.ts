import { getAuthContext, type AuthContext } from './get-auth-context';

/**
 * Guard partagé : autorise les rôles `dirigeant` ET `regulateur`.
 *
 * Pattern repris de `requireDirigeant` (local Phase 03.1) — élargi
 * Phase 04 hotfix (DEC-029). Utilisé par :
 *   - chauffeurs/actions.ts : createDriver, updateDriver, archiveDriver,
 *     inviteDriver, resendInvitation
 *
 * Ne PAS utiliser pour les pages admin dirigeant-only (DPIA, DPA,
 * breaches, vehicules) qui restent verrouillées au dirigeant via leur
 * `requireDirigeant` local.
 *
 * @returns AuthContext si dirigeant OU regulateur, sinon null.
 */
export async function requireAdminOrRegulateur(): Promise<AuthContext | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  if (ctx.role !== 'dirigeant' && ctx.role !== 'regulateur') return null;
  return ctx;
}
