import 'server-only';
import { getAuthContext, type AuthContext } from '@/lib/auth/get-auth-context';

/**
 * Helper auth pour Route Handlers chauffeur (Phase 04.9 PWA Wave 1).
 *
 * Réutilise `getAuthContext()` (compatible cookies() Route Handler comme
 * Server Action) et ajoute la résolution du `driver_id` via jointure
 * `drivers.profile_id ↔ auth.users.id`.
 *
 * Retourne discrimination ok/error pour pattern early-return propre dans
 * les Route Handlers (cf start/route.ts, end/route.ts).
 *
 * Refs : DEC-045 LOCKED, PLAN-1.md.
 */

type DriverIdRow = { id: string };

export type DriverAuthResult =
  | {
      ok: true;
      ctx: AuthContext;
      driverId: string;
    }
  | {
      ok: false;
      error: string;
      status: 401 | 403;
    };

export async function requireDriverFromRouteHandler(): Promise<DriverAuthResult> {
  const ctx = await getAuthContext();
  if (!ctx) {
    return { ok: false, error: 'Session expirée. Reconnectez-vous.', status: 401 };
  }
  if (ctx.role !== 'chauffeur') {
    return { ok: false, error: 'Accès réservé aux chauffeurs.', status: 403 };
  }

  const { data } = await ctx.supabase
    .from('drivers' as never)
    .select('id')
    .eq('profile_id', ctx.userId)
    .eq('organization_id', ctx.organizationId)
    .eq('archive', false)
    .maybeSingle();

  const driverRow = (data as DriverIdRow | null) ?? null;
  if (!driverRow) {
    return {
      ok: false,
      error:
        "Votre compte chauffeur n'est pas encore relié à un profil chauffeur. Contactez votre dirigeant.",
      status: 403,
    };
  }

  return { ok: true, ctx, driverId: driverRow.id };
}
