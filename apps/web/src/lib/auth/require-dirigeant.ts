import { getAuthContext, type AuthContext } from './get-auth-context';

/**
 * Guard Server Actions : autorise uniquement le rôle `dirigeant`.
 *
 * Pattern symétrique de `requireAdminOrRegulateur` — utilisé pour les
 * actions à granularité plus stricte (archivage chauffeur, opérations
 * RGPD critiques). DEC-029 sémantique 4 actions : seul le dirigeant
 * peut archiver / désarchiver / modifier un motif d'archivage.
 *
 * @returns AuthContext si dirigeant, sinon null.
 */
export async function requireDirigeant(): Promise<AuthContext | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  if (ctx.role !== 'dirigeant') return null;
  return ctx;
}
