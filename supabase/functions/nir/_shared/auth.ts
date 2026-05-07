// supabase/functions/nir/_shared/auth.ts
// Wrapper d'authentification JWT pour l'Edge Function NIR.
//
// Pattern (RESEARCH.md lignes 121-137 + PATTERNS.md ligne 711-714) :
// - Le caller (Server Action ou navigateur) envoie son JWT dans `Authorization`.
// - On valide le JWT via supabase.auth.getUser() (vérif signature côté Supabase).
// - On lit l'organization_id depuis le profil RLS du user.
// - L'INSERT audit_logs utilise un client SERVICE_ROLE distinct pour garantir
//   l'écriture même si la policy RLS du user serait restrictive.
//
// Aucun console.* — pas de log, le NIR ne transite pas par ce module.

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export interface AuthContext {
  userId: string;
  organizationId: string;
  jwt: string;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Valide le JWT du caller et résout son organization_id.
 * Lève AuthError("Non autorisé") au moindre défaut (header absent, JWT invalide,
 * profil manquant) — le caller voit toujours le même message, sans détail.
 */
export async function authenticate(
  req: Request,
  override?: SupabaseLike,
): Promise<AuthContext> {
  const auth = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth) throw new AuthError("Non autorisé");

  // Mode test : un client stubbé est injecté ; on saute la résolution profile
  // (l'appelant fournit lui-même organization_id dans le body).
  if (override) {
    const result = await override.auth.getUser(auth);
    const user = result?.data?.user;
    if (!user) throw new AuthError("Non autorisé");
    return { userId: user.id, organizationId: "", jwt: auth };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.auth.getUser(auth);
  if (error || !data?.user) throw new AuthError("Non autorisé");
  const user = data.user;

  // Lit organization_id depuis profiles via RLS du user (le JWT contraint la
  // requête à ses propres lignes — on ne peut pas leak l'org d'un autre user).
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${auth}` } },
      auth: { persistSession: false },
    },
  );
  const { data: profile } = await userClient
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new AuthError("Non autorisé");

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    jwt: auth,
  };
}

/** Client admin (service_role) — utilisé UNIQUEMENT pour audit_logs INSERT. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Forme minimale d'un client Supabase ; suffisante pour les tests stub. */
export interface SupabaseLike {
  auth: {
    getUser: (jwt: string) => Promise<{
      data: { user: { id: string } | null };
      error?: unknown;
    }>;
  };
  from: (table: string) => {
    insert: (row: unknown) => { error: unknown } | Promise<{ error: unknown }>;
  };
}
