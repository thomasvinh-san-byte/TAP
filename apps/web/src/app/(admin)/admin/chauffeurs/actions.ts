'use server';

/**
 * Server Actions admin chauffeurs (clôture-bis Passe 1).
 *
 * Pattern (CLAUDE.md § 10) : useFormState → safeParse zod → guard rôle
 * dirigeant (defense in depth en plus de RLS Postgres
 * `drivers_insert_dirigeant` / `drivers_update_dirigeant`) → INSERT/UPDATE
 * → revalidatePath. Audit log automatique via trigger Postgres
 * `drivers_audit_trigger`.
 *
 * Pas de hard DELETE (CLAUDE.md anti-pattern) : `archiveDriverAction` pose
 * `archive=true` + `archive_at` + `actif=false`.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import {
  archiveDriverInputSchema,
  driverInputSchema,
  driverInvitationSchema,
} from '@tap/shared';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { createAdminClient } from '@/lib/supabase/admin';

export type ActionState = {
  success?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

// requireDirigeant a été supprimé Phase 04 hotfix (DEC-029) — les Server
// Actions chauffeurs sont élargies au régulateur via le guard partagé
// `requireAdminOrRegulateur`. Les autres modules admin (vehicules, DPIA,
// DPA, breaches) conservent leur guard `requireDirigeant` local.

function parseFormData(formData: FormData) {
  return driverInputSchema.safeParse({
    nom_affichage: formData.get('nom_affichage'),
    telephone: formData.get('telephone'),
    numero_licence: formData.get('numero_licence'),
    type_permis: formData.getAll('type_permis'),
    actif: formData.get('actif') === 'on',
  });
}

function flattenFieldErrors(
  err: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.flatten().fieldErrors)) {
    if (v && v[0]) out[k] = v[0];
  }
  return out;
}

export async function createDriverAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { data, error } = await ctx.supabase
    .from('drivers' as never)
    .insert({
      ...parsed.data,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      telephone: parsed.data.telephone || null,
      numero_licence: parsed.data.numero_licence || null,
    } as never)
    .select('id')
    .single();

  if (error || !data) return { error: 'Création chauffeur impossible.' };
  revalidatePath('/admin/chauffeurs');
  return { success: true, id: (data as { id: string }).id };
}

export async function updateDriverAction(
  driverId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(driverId).success) {
    return { error: 'Identifiant chauffeur invalide.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { error, data } = await ctx.supabase
    .from('drivers' as never)
    .update({
      ...parsed.data,
      telephone: parsed.data.telephone || null,
      numero_licence: parsed.data.numero_licence || null,
    } as never)
    .eq('id', driverId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Modification impossible.' };
  if (!data) return { error: 'Chauffeur introuvable ou archivé.' };

  revalidatePath('/admin/chauffeurs');
  return { success: true, id: driverId };
}

/**
 * `archiveDriverAction` — archive un chauffeur (soft-delete).
 *
 * Hotfix Phase 04 (DEC-029) : confirmation renforcée option C.
 *  - Élargi au régulateur (en plus du dirigeant)
 *  - Modal UI exige saisie d'un motif libre (10-500 chars) ET d'une
 *    confirmation textuelle « ARCHIVER » avant submit
 *  - Motif stocké en BDD (`drivers.archive_motif`) et journalisé dans
 *    `audit_logs` (action `driver_archived`) avec acteur + rôle.
 *
 * Signature modifiée — accepte `formData` pour parse zod du motif. Appelé
 * via `useFormState` côté `ArchiveDriverModal`.
 */
export async function archiveDriverAction(
  driverId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(driverId).success) {
    return { error: 'Identifiant chauffeur invalide.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  // Confirmation renforcée : motif (10-500 chars) + saisie « ARCHIVER »
  const parsed = archiveDriverInputSchema.safeParse({
    motif: formData.get('motif'),
    confirmation: formData.get('confirmation'),
  });
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs de confirmation.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }
  const { motif } = parsed.data;

  // Lecture courante pour valider état (non déjà archivé) — RLS bloque
  // automatiquement les autres orgs, donc pas besoin de check organization_id.
  const { data: current, error: fetchErr } = await ctx.supabase
    .from('drivers' as never)
    .select('id, archive, nom_affichage')
    .eq('id', driverId)
    .maybeSingle();
  if (fetchErr) return { error: 'Lecture chauffeur impossible.' };
  if (!current) return { error: 'Chauffeur introuvable.' };
  if ((current as { archive: boolean }).archive) {
    return { error: 'Chauffeur déjà archivé.' };
  }

  // UPDATE archive + motif (trigger Postgres audit émet `driver_updated`
  // automatiquement — on ajoute en plus un audit applicatif sémantique
  // `driver_archived` avec le motif et l'acteur, pour traçabilité claire
  // côté RGPD et historique chauffeur).
  const { error: updErr } = await ctx.supabase
    .from('drivers' as never)
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      archive_motif: motif,
      actif: false,
    } as never)
    .eq('id', driverId)
    .eq('archive', false);

  if (updErr) return { error: 'Archivage impossible.' };

  // Audit log applicatif — événement sémantique distinct du UPDATE technique.
  // Type `driver_archived` + metadata { motif, archived_by, archived_by_role }
  // pour permettre la requête « qui a archivé quoi avec quel motif ».
  await ctx.supabase.from('audit_logs' as never).insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'driver_archived',
    entity_type: 'driver',
    entity_id: driverId,
    metadata: {
      motif,
      archived_by_role: ctx.role,
      driver_nom_affichage: (current as { nom_affichage: string }).nom_affichage,
    },
  } as never);

  revalidatePath('/admin/chauffeurs');
  return { success: true };
}

// ──────────────────────────────────────────────────────────────────────
// PLAN-3 : Server Actions invitation chauffeur (C02 + C03)
// ──────────────────────────────────────────────────────────────────────

/**
 * Résout l'origine de la requête courante (header `origin` Next.js, fallback
 * env `NEXT_PUBLIC_APP_URL`). Utilisé pour construire le `redirectTo` du
 * magic link Supabase.
 */
function resolveOrigin(): string {
  const origin = headers().get('origin');
  if (origin) return origin;
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl) return envUrl;
  throw new Error('Origin introuvable (header + NEXT_PUBLIC_APP_URL absents).');
}

/**
 * `inviteDriverAction` (C02) — invite un chauffeur par email.
 *
 * Pattern (PLAN-3 §3.2, 8 étapes) :
 *   1. Guard rôle dirigeant
 *   2. Validation zod driverInvitationSchema
 *   3. Check email collision (autre user déjà inscrit)
 *   4. Check driver appartient à l'org + actif + non rattaché
 *   5. Supabase.auth.admin.inviteUserByEmail (service_role, server-only)
 *   6. INSERT driver_invitations (status='pending')
 *   7. revalidatePath
 *   8. Retour ActionState
 *
 * Trigger Postgres `driver_invitations_audit_trigger` émet
 * `driver_invited` automatiquement (PLAN-2 §2.1.5) — pas d'audit applicatif
 * ici.
 */
export async function inviteDriverAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // 1. Guard rôle dirigeant (defense in depth ; RLS BDD double-checke)
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  // 2. Validation zod
  const parsed = driverInvitationSchema.safeParse({
    email: formData.get('email'),
    driverId: formData.get('driverId'),
  });
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }
  const { email, driverId } = parsed.data;

  // Client admin (service_role) instancié localement — JAMAIS exposé client.
  // Le fichier porte le 'use server' du top → ce client reste server-only.
  const supabaseAdmin = createAdminClient();

  // 3. Check collision email autre rôle
  //    auth.admin.listUsers() scanne tous les users de l'instance Supabase.
  //    Acceptable V1 (peu de users) ; à indexer en Phase 06+ si besoin perf.
  const { data: usersList, error: listErr } =
    await supabaseAdmin.auth.admin.listUsers();
  if (listErr) return { error: 'Vérification email impossible.' };
  const collision = usersList?.users?.find(
    (u) => u.email?.toLowerCase() === email,
  );
  if (collision) {
    return { error: 'Cet email est déjà utilisé pour un autre rôle.' };
  }

  // 4. Vérifier driver existe + appartient à l'org du dirigeant (RLS) +
  //    actif + pas déjà rattaché à un profile_id
  const { data: driver, error: drvErr } = await ctx.supabase
    .from('drivers' as never)
    .select('id, profile_id, archive, actif, organization_id')
    .eq('id', driverId)
    .maybeSingle();
  if (drvErr) return { error: 'Lecture chauffeur impossible.' };
  if (!driver) return { error: 'Chauffeur introuvable.' };

  const drv = driver as {
    id: string;
    profile_id: string | null;
    archive: boolean;
    actif: boolean;
    organization_id: string;
  };
  if (drv.archive) return { error: 'Chauffeur archivé.' };
  if (!drv.actif) return { error: 'Chauffeur inactif.' };
  if (drv.profile_id) {
    return { error: 'Ce chauffeur a déjà un compte actif.' };
  }
  if (drv.organization_id !== ctx.organizationId) {
    // En théorie bloqué par RLS, mais defense in depth applicative.
    return { error: 'Chauffeur hors organisation.' };
  }

  // 5. Magic link invitation (Supabase Auth admin)
  const origin = resolveOrigin();
  const { error: inviteErr } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        role: 'chauffeur',
        driver_id: driverId,
        organization_id: ctx.organizationId,
      },
      redirectTo: `${origin}/accept-invite/verify`,
    });
  if (inviteErr) {
    // Rate limit Supabase (3 emails/h défaut SMTP intégré)
    if (
      inviteErr.status === 429 ||
      (inviteErr.message ?? '').toLowerCase().includes('rate')
    ) {
      return {
        error:
          'Email non envoyé (limite atteinte, ré-essayer dans 1h ou contacter support).',
      };
    }
    return { error: 'Envoi de l\'invitation impossible.' };
  }

  // 6. INSERT driver_invitations (RLS-protégé : dirigeant same-org via policy
  //    `driver_invitations_insert_dirigeant`). Trigger audit AFTER INSERT
  //    écrit la ligne `driver_invited` automatiquement.
  const { data: invitation, error: insertErr } = await ctx.supabase
    .from('driver_invitations' as never)
    .insert({
      organization_id: ctx.organizationId,
      driver_id: driverId,
      invited_by: ctx.userId,
      email,
      role: 'chauffeur',
      status: 'pending',
    } as never)
    .select('id')
    .single();

  if (insertErr || !invitation) {
    // Unique index partiel pending : invitation déjà en cours pour cet email
    if (insertErr?.code === '23505') {
      return { error: 'Une invitation est déjà en cours pour cet email.' };
    }
    return { error: 'Enregistrement de l\'invitation impossible.' };
  }

  // 7. Revalidate liste chauffeurs (badge « invitation envoyée »)
  revalidatePath('/admin/chauffeurs');

  // 8. ActionState success
  return { success: true, id: (invitation as { id: string }).id };
}

/**
 * `resendInvitationAction` (C03) — relance un email invitation perdu.
 *
 * Anti-race : refuse de relancer si l'invitation a été créée il y a moins
 * de 1 minute (expires_at quasi à +24h). Évite double-click du dirigeant.
 *
 * Trigger Postgres émet `driver_invitation_resent` au UPDATE de `expires_at`.
 */
export async function resendInvitationAction(
  invitationId: string,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(invitationId).success) {
    return { error: 'Identifiant invitation invalide.' };
  }
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  // 1. Fetch invitation + ownership + status
  const { data: invitation, error: fetchErr } = await ctx.supabase
    .from('driver_invitations' as never)
    .select('id, email, status, invited_by, expires_at')
    .eq('id', invitationId)
    .eq('invited_by', ctx.userId)
    .maybeSingle();
  if (fetchErr) return { error: 'Lecture invitation impossible.' };
  if (!invitation) return { error: 'Invitation introuvable.' };

  const inv = invitation as {
    id: string;
    email: string;
    status: string;
    expires_at: string;
  };
  if (inv.status !== 'pending') {
    return { error: 'Cette invitation n\'est plus en attente.' };
  }

  // 2. Anti-race : refuser un resend si expires_at - now() > 23h59m
  //    (l'invitation vient juste d'être créée → double-click protection)
  const remainingMs = new Date(inv.expires_at).getTime() - Date.now();
  if (remainingMs > 23 * 60 * 60 * 1000 + 59 * 60 * 1000) {
    return {
      error:
        'Invitation envoyée à l\'instant. Patientez quelques minutes avant relance.',
    };
  }

  // 3. Re-call Supabase Auth invite (regen token magic link)
  const supabaseAdmin = createAdminClient();
  const origin = resolveOrigin();
  const { error: resendErr } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: `${origin}/accept-invite/verify`,
    });
  if (resendErr) {
    if (
      resendErr.status === 429 ||
      (resendErr.message ?? '').toLowerCase().includes('rate')
    ) {
      return {
        error: 'Email non envoyé (limite atteinte, ré-essayer dans 1h).',
      };
    }
    return { error: 'Renvoi de l\'invitation impossible.' };
  }

  // 4. Bump expires_at à +24h (trigger émet `driver_invitation_resent`)
  const newExpiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const { error: updErr } = await ctx.supabase
    .from('driver_invitations' as never)
    .update({ expires_at: newExpiresAt } as never)
    .eq('id', invitationId);
  if (updErr) return { error: 'Mise à jour invitation impossible.' };

  revalidatePath('/admin/chauffeurs');
  return { success: true, id: invitationId };
}
