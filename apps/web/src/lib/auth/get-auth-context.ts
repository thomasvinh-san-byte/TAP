import 'server-only';
import { cookies as _cookies } from 'next/headers';
import type { UserRole } from '@tap/database/types';
import { createClient } from '@/lib/supabase/server';

/**
 * Contexte d'auth résolu côté serveur (Server Actions + RSC queries).
 *
 * Source unique de vérité pour les checks de rôle applicatifs (en complément
 * de RLS Postgres — defense in depth, CLAUDE.md § 6 / DEC-005 Phase 2).
 *
 * Pattern d'usage :
 *   const ctx = await getAuthContext();
 *   if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
 *   if (ctx.role !== 'dirigeant') return { error: 'Action réservée…' };
 *
 * NB : on ne throw PAS sur absence de session — on rend `null` pour laisser
 * l'appelant retourner un ActionState propre (jamais d'erreur brute UI).
 */

export type AuthContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  organizationId: string;
  role: UserRole;
  profile: {
    id: string;
    organization_id: string;
    role: UserRole;
    prenom: string;
    nom: string;
    email: string;
  };
};

export async function getAuthContext(): Promise<AuthContext | null> {
  // L'import explicite évite que `next/headers` soit eagerly tree-shaké
  // dans des contextes RSC où cookies() doit être appelé.
  void _cookies;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, organization_id, role, prenom, nom, email')
    .eq('id', user.id)
    .single();
  if (error) {
    console.error('[auth/get-context] Erreur Supabase:', error);
  }
  const profile = data as AuthContext['profile'] | null;
  if (!profile) return null;

  return {
    supabase,
    userId: user.id,
    organizationId: profile.organization_id,
    role: profile.role,
    profile,
  };
}
