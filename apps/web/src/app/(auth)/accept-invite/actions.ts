'use server';

/**
 * Server Action `acceptInvitationAction` — partie code de C04 (Phase 04, PLAN-3).
 *
 * La page UI `/accept-invite` (Client Component + form) est implémentée
 * dans PLAN-4. Cette action consomme un formData {password, confirmPassword,
 * cguAccepted} et un user déjà authentifié (session créée par le Route
 * Handler GET `/accept-invite` via `supabase.auth.verifyOtp`, PLAN-4 §4.3).
 *
 * Étapes (PLAN-3 §3.4) :
 *   0. Session active (sinon lien expiré → demander un nouveau)
 *   1. Validation zod acceptInvitationSchema (mdp ≥ 8, match, CGU=true)
 *   2. Retrouver invitation pending matchant l'email user
 *   3. Check expires_at > now()
 *   4. supabase.auth.updateUser({ password }) (mdp défini)
 *   5. UPDATE driver_invitations.status='accepted' (trigger audit
 *      `driver_invitation_accepted`)
 *   6. UPDATE drivers.profile_id = auth.uid() (clause `.is('profile_id', null)`
 *      pour idempotence + anti double-rattachement)
 *   7. INSERT audit_logs `cgu_accepted_via_invitation` (DEC-027 — NON émis
 *      par trigger, log applicatif obligatoire RGPD)
 *   8. redirect('/conduite?activated=1') (flag toast côté /conduite, PLAN-4
 *      §4.5bis ActivationToast)
 */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { acceptInvitationSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export type AcceptState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function flattenFieldErrors(err: z.ZodError): Record<string, string> {
  // Helper local : on ne réutilise pas celui de admin/chauffeurs/actions.ts
  // pour garder ce fichier autonome (pas d'import cross-route-group).
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.flatten().fieldErrors)) {
    if (Array.isArray(v) && v[0]) flat[k] = v[0];
  }
  return flat;
}

export async function acceptInvitationAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const supabase = createClient();

  // 0. Session active (créée par /accept-invite GET via verifyOtp — PLAN-4 §4.3)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Session expirée. Demandez un nouveau lien à votre régulateur.' };
  }
  const userEmail = user.email?.toLowerCase();
  if (!userEmail) {
    return { error: 'Email du compte introuvable.' };
  }

  // 1. Validation zod
  const parsed = acceptInvitationSchema.safeParse({
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    cguAccepted: formData.get('cguAccepted') === 'on',
  });
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  // 2. Retrouver l'invitation pending pour l'email user actuel
  //    (RLS policy `driver_invitations_select_invited_or_recipient` autorise
  //    le user à voir SA propre invitation via match `email=auth.users.email`).
  const { data: invitation, error: invFetchErr } = await supabase
    .from('driver_invitations' as never)
    .select('id, driver_id, status, expires_at, organization_id')
    .eq('email', userEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invFetchErr) {
    return { error: 'Lecture invitation impossible.' };
  }
  if (!invitation) {
    return { error: 'Aucune invitation valide pour ce compte.' };
  }

  const inv = invitation as {
    id: string;
    driver_id: string;
    status: string;
    expires_at: string;
    organization_id: string;
  };

  // 3. Check expires_at > now() (defense in depth applicative ;
  //    RLS UPDATE policy le re-check côté Postgres)
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return {
      error: 'Lien d\'invitation expiré. Demandez un nouveau lien à votre régulateur.',
    };
  }

  // 4. Définir le mot de passe (Supabase Auth)
  const { error: pwErr } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (pwErr) {
    return { error: 'Définition du mot de passe impossible.' };
  }

  // 5. UPDATE driver_invitations → accepted (trigger audit émet
  //    `driver_invitation_accepted`).
  const { error: invUpdErr } = await supabase
    .from('driver_invitations' as never)
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    } as never)
    .eq('id', inv.id)
    .eq('status', 'pending');
  if (invUpdErr) {
    return { error: 'Validation de l\'invitation impossible.' };
  }

  // 6. UPDATE drivers.profile_id = auth.uid() — clause `.is('profile_id', null)`
  //    rend l'opération idempotente (race condition : double submit → la 2ᵉ
  //    requête match 0 row).
  const { error: drvUpdErr } = await supabase
    .from('drivers' as never)
    .update({ profile_id: user.id } as never)
    .eq('id', inv.driver_id)
    .is('profile_id', null);
  if (drvUpdErr) {
    return { error: 'Rattachement du compte chauffeur impossible.' };
  }

  // 7. Audit log applicatif `cgu_accepted_via_invitation` (DEC-027).
  //    Trace l'acceptation des CGU + version, indépendamment du trigger
  //    `driver_invitation_accepted` qui ne porte PAS cette info.
  await supabase.from('audit_logs' as never).insert({
    organization_id: inv.organization_id,
    actor_id: user.id,
    actor_role: 'chauffeur',
    action: 'cgu_accepted_via_invitation',
    entity_type: 'driver',
    entity_id: inv.driver_id,
    metadata: {
      invitation_id: inv.id,
      cgu_version: process.env.NEXT_PUBLIC_CGU_VERSION ?? 'v1.0',
    },
  } as never);

  // 8. Redirect vers le shell chauffeur avec flag toast success
  //    (FLAG #1 — consommé côté /conduite/page.tsx via ActivationToast,
  //    cf. PLAN-4 §4.5bis).
  revalidatePath('/conduite');
  redirect('/conduite?activated=1');
}
