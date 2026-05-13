import { redirect } from 'next/navigation';
import { getAuthContext, type AuthContext } from './get-auth-context';

/**
 * Guard SSR pour les pages Server Components qui doivent rester accessibles
 * UNIQUEMENT au rôle `dirigeant` (vehicules, registre RGPD, DPIA, DPA,
 * breaches, requests, DPO).
 *
 * Phase 04 hotfix (DEC-029) : le layout `(admin)` est élargi au régulateur
 * pour permettre l'accès à `/admin/chauffeurs`. Les autres pages admin
 * restent dirigeant-only — appeler ce helper en tête de chaque page pour
 * rediriger un régulateur vers `/admin/chauffeurs` (route admin légitime
 * pour son rôle).
 *
 * Pattern à utiliser dans chaque page concernée :
 *
 * ```ts
 * export default async function Page() {
 *   await requireDirigeantPage();
 *   // … reste du Server Component
 * }
 * ```
 *
 * @returns AuthContext si dirigeant, sinon redirect ne retourne jamais.
 */
export async function requireDirigeantPage(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect('/login');
  if (ctx.role !== 'dirigeant') redirect('/admin/chauffeurs');
  return ctx;
}
