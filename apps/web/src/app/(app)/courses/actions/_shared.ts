/**
 * Internes partagés des Server Actions du module Courses.
 *
 * NB : ce fichier n'expose PAS de Server Action (pas de `'use server'`).
 * Il contient uniquement des helpers serveur partagés par ≥ 2 fichiers
 * d'actions (create / drafts / assignment / payment / list).
 *
 * Pattern (CLAUDE.md § 10) : Validation zod → Authz (RLS Postgres) →
 * Transaction → Audit log (trigger Postgres rides_audit_trigger) → Réponse.
 *
 * Notes sécurité (rappel, applicable à tous les fichiers du module) :
 *   - Le check de rôle (regulateur/dirigeant) est délégué à RLS Postgres
 *     pour les flux INSERT/UPDATE (policies rides_*_regulateur) — DRY.
 *     Le double-check applicatif (REGULATEUR_OR_DIRIGEANT) reste utilisé
 *     pour les mutations sensibles (assign / paiement) — defense in depth.
 *   - Le `service_role` n'est JAMAIS utilisé ici.
 *   - Aucun import direct `@supabase/*` ; uniquement le wrapper serveur.
 *   - Tous les messages d'erreur sont reformulés en français (CLAUDE.md § 5).
 */

import 'server-only';
import { createClient } from '@/lib/supabase/server';

export type ActionState = {
  error?: string;
  success?: boolean;
  id?: string;
};

/**
 * Auth + profile org_id en une étape. Retourne `null` si non authentifié
 * ou profil absent — l'action appelante doit short-circuit avec une erreur FR.
 *
 * Variante « minimale » historique de `@/lib/auth/get-auth-context`
 * (sans le rôle ni le profile complet — moins de colonnes requises sur
 * `profiles`). Conservée car utilisée par les actions Phase 2 sans
 * gating de rôle applicatif (la sécurité repose sur RLS Postgres).
 */
export async function getAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return null;
  return { supabase, user, organization_id: profile.organization_id };
}

/**
 * Whitelist des rôles autorisés à muter une course (assignation / paiement).
 * Utilisé conjointement avec `@/lib/auth/get-auth-context` qui charge le
 * rôle depuis la table `profiles`.
 */
export const REGULATEUR_OR_DIRIGEANT = ['regulateur', 'dirigeant'] as const;
