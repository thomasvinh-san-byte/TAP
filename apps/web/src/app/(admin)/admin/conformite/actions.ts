'use server';

/**
 * Server Actions Conformité réglementaire (Phase 06.33, DEC-112).
 *
 * Pattern (CLAUDE.md § 10) : zod safeParse → guard rôle dirigeant
 * (defense in depth — RLS Postgres l'exige aussi) → INSERT/UPDATE avec
 * row-count check (DEC-041) → revalidatePath. Trigger Postgres
 * `compliance_items_audit_trigger` journalise automatiquement.
 *
 * Périmètre lot 1 : upsert + archive (pas de hard DELETE). Le statut est
 * dérivé à l'affichage (`complianceStatus`), jamais stocké.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  complianceItemUpsertSchema,
  COMPLIANCE_ENTITY_TYPES,
  COMPLIANCE_KINDS,
  type ComplianceEntityType,
} from '@tap/shared';
import {
  COMPLIANCE_BUCKET,
  COMPLIANCE_ALLOWED_MIME,
  COMPLIANCE_MAX_BYTES,
  COMPLIANCE_SIGNED_URL_TTL,
  buildCompliancePath,
  pathBelongsToOrg,
} from '@/lib/storage/compliance-documents';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { sendEmail } from '@/lib/email/send';

const blockingModeSchema = z.enum(['warn', 'block']);

/**
 * Met à jour le réglage organisation `compliance_blocking_mode`
 * (Phase 06.35 DEC-114). Réservé dirigeant ; DEC-041 row-count check.
 */
export async function updateComplianceBlockingModeAction(raw: unknown): Promise<ActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const parsed = blockingModeSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Valeur invalide.' };

  const { data, error } = await ctx.supabase
    .from('organizations')
    .update({ compliance_blocking_mode: parsed.data })
    .eq('id', ctx.organizationId)
    .select('id');

  if (error) return { error: 'Mise à jour impossible.' };
  if (!data || data.length === 0) {
    return { error: 'Mise à jour refusée : droits insuffisants.' };
  }
  revalidatePath('/admin/conformite');
  revalidatePath('/cockpit');
  return { success: true, id: ctx.organizationId };
}

export type ActionState = {
  success?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function flattenFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.flatten().fieldErrors)) {
    if (v && v[0]) out[k] = v[0];
  }
  return out;
}

function dateOrNull(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

/**
 * Upsert d'une échéance. `id` présent = UPDATE, absent = INSERT.
 *
 * UPDATE applique le row-count check DEC-041 : si la ligne n'appartient
 * pas à l'organisation ou est archivée, l'UPDATE ne touche aucune ligne
 * et on remonte une erreur explicite (pas un silence).
 */
export async function upsertComplianceItemAction(raw: unknown): Promise<ActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const parsed = complianceItemUpsertSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: 'Vérifiez les champs.', fieldErrors: flattenFieldErrors(parsed.error) };
  }
  const v = parsed.data;

  const payload = {
    entity_type: v.entity_type,
    entity_id: v.entity_id,
    kind: v.kind,
    label: v.label && v.label.length > 0 ? v.label : null,
    reference: v.reference && v.reference.length > 0 ? v.reference : null,
    issued_at: dateOrNull(v.issued_at),
    expires_at: dateOrNull(v.expires_at),
  };

  if (v.id) {
    const { data, error } = await ctx.supabase
      .from('compliance_items')
      .update(payload)
      .eq('id', v.id)
      .eq('archive', false)
      .select('id');

    if (error) return { error: 'Modification impossible.' };
    if (!data || data.length === 0) {
      return { error: 'Échéance introuvable : droits insuffisants ou archivée.' };
    }
    revalidatePath('/admin/conformite');
    revalidatePath('/admin/chauffeurs');
    revalidatePath('/admin/vehicules');
    await maybeNotifyDeadline(ctx, v.kind, payload.expires_at);
    return { success: true, id: v.id };
  }

  const { data, error } = await ctx.supabase
    .from('compliance_items')
    .insert({
      ...payload,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) return { error: 'Création échéance impossible.' };
  revalidatePath('/admin/conformite');
  revalidatePath('/admin/chauffeurs');
  revalidatePath('/admin/vehicules');
  await maybeNotifyDeadline(ctx, v.kind, payload.expires_at);
  return { success: true, id: (data as { id: string }).id };
}

/**
 * Point de déclenchement de DÉMONSTRATION de la couture email (DEC-144, D-04).
 *
 * Après l'enregistrement d'une échéance, si elle arrive à terme (≤ 30 j) ou est
 * dépassée, on notifie le dirigeant via `sendEmail`. Comme `sendEmail` est un
 * no-op tant que `EMAIL_ENABLED` est OFF, ceci ne fait RIEN en prod (log seul).
 * Best-effort : ne lève jamais, ne bloque jamais la sauvegarde. Prouve que la
 * couture fonctionne — pas la livraison de la feature (récap quotidien, gabarits
 * et persistance des préférences restent à construire, registre §1.2).
 */
async function maybeNotifyDeadline(
  ctx: Awaited<ReturnType<typeof requireDirigeant>>,
  kind: string,
  expiresAt: string | null,
): Promise<void> {
  if (!ctx || !expiresAt) return;
  try {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
    if (Number.isNaN(days) || days > 30) return;
    const { data } = await ctx.supabase.auth.getUser();
    const to = data.user?.email;
    if (!to) return;
    await sendEmail({
      to,
      subject: 'Conformité : échéance à surveiller',
      body: `Une échéance de conformité (${kind}) arrive à terme dans ${days} jour(s).`,
    });
  } catch {
    // Best-effort : une notification ne doit jamais casser l'enregistrement.
  }
}

/**
 * Archivage logique d'une échéance (soft-delete).
 * UPDATE avec row-count check DEC-041.
 */
export async function archiveComplianceItemAction(id: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(id).success) {
    return { error: 'Identifiant d’échéance invalide.' };
  }
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const { data, error } = await ctx.supabase
    .from('compliance_items')
    .update({ archive: true, archive_at: new Date().toISOString() })
    .eq('id', id)
    .eq('archive', false)
    .select('id');

  if (error) return { error: 'Archivage impossible.' };
  if (!data || data.length === 0) {
    return { error: 'Échéance introuvable : droits insuffisants ou déjà archivée.' };
  }
  revalidatePath('/admin/conformite');
  revalidatePath('/admin/chauffeurs');
  revalidatePath('/admin/vehicules');
  return { success: true, id };
}

/**
 * Liste les items d'une entité (driver, vehicle ou organization). Lit
 * via le contexte Supabase serveur — la RLS `compliance_items_select_same_org`
 * fait le cloisonnement.
 */
export interface ComplianceItemRow {
  id: string;
  entity_type: ComplianceEntityType;
  entity_id: string | null;
  kind: string;
  label: string | null;
  reference: string | null;
  issued_at: string | null;
  expires_at: string | null;
  document_url: string | null;
}

export async function listComplianceItemsForEntityAction(
  entityType: ComplianceEntityType,
  entityId: string | null,
): Promise<{ items: ComplianceItemRow[]; error?: string }> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { items: [], error: 'Accès non autorisé.' };

  let query = ctx.supabase
    .from('compliance_items')
    .select(
      'id, entity_type, entity_id, kind, label, reference, issued_at, expires_at, document_url',
    )
    .eq('entity_type', entityType)
    .eq('archive', false);

  if (entityType === 'organization') {
    query = query.is('entity_id', null);
  } else if (entityId) {
    query = query.eq('entity_id', entityId);
  } else {
    return { items: [] };
  }

  const { data, error } = await query;
  if (error) return { items: [], error: 'Lecture impossible.' };
  return { items: (data as ComplianceItemRow[] | null) ?? [] };
}

/**
 * Upload RÉEL d'un justificatif de conformité (DEC-143, déblocage bêta).
 *
 * Bucket PRIVÉ Supabase Storage sous DPA (DEC-077 : HDS = prérequis prod, pas
 * bêta). Validation SERVEUR (type MIME liste blanche, taille, présence),
 * écriture réservée au dirigeant de l'organisation (RLS Storage + guard), chemin
 * org-scoped. On stocke le CHEMIN de l'objet (bucket privé) dans
 * `compliance_items.document_url` — jamais d'URL publique ; la lecture passe par
 * une URL signée (`getComplianceDocumentUrlAction`). Aucun montant, aucun faux
 * succès (les erreurs Storage / persistance sont remontées explicitement).
 */
export async function uploadComplianceDocumentAction(
  formData: FormData,
): Promise<{ success?: true; path?: string; id?: string; error?: string }> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Aucun fichier reçu.' };
  if (!(COMPLIANCE_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return { error: 'Format non accepté. Formats autorisés : PDF, JPEG, PNG.' };
  }
  if (file.size > COMPLIANCE_MAX_BYTES) {
    return { error: 'Fichier trop volumineux (10 Mo maximum).' };
  }

  const metaSchema = z.object({
    entity_type: z.enum(COMPLIANCE_ENTITY_TYPES),
    entity_id: z.string().uuid().nullable(),
    kind: z.enum(COMPLIANCE_KINDS),
    item_id: z.string().uuid().optional(),
  });
  const rawEntityId = formData.get('entity_id');
  const rawItemId = formData.get('item_id');
  const meta = metaSchema.safeParse({
    entity_type: formData.get('entity_type'),
    entity_id: typeof rawEntityId === 'string' && rawEntityId.length > 0 ? rawEntityId : null,
    kind: formData.get('kind'),
    item_id: typeof rawItemId === 'string' && rawItemId.length > 0 ? rawItemId : undefined,
  });
  if (!meta.success) return { error: 'Contexte du document invalide.' };

  const path = buildCompliancePath({
    organizationId: ctx.organizationId,
    entityType: meta.data.entity_type,
    entityId: meta.data.entity_id,
    filename: file.name,
    uuid: crypto.randomUUID(),
  });

  const up = await ctx.supabase.storage
    .from(COMPLIANCE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { error: 'Téléversement impossible.' };

  // Persiste le POINTEUR (chemin) sur l'échéance : MAJ si elle existe déjà,
  // sinon création (row-count check DEC-041 sur la MAJ). RLS = cloisonnement org.
  if (meta.data.item_id) {
    const { data, error } = await ctx.supabase
      .from('compliance_items')
      .update({ document_url: path })
      .eq('id', meta.data.item_id)
      .eq('archive', false)
      .select('id');
    if (error || !data || data.length === 0) {
      return { error: 'Échéance introuvable : droits insuffisants ou archivée.' };
    }
    revalidatePath('/admin/conformite');
    revalidatePath('/admin/chauffeurs');
    revalidatePath('/admin/vehicules');
    return { success: true, path, id: meta.data.item_id };
  }

  const { data, error } = await ctx.supabase
    .from('compliance_items')
    .insert({
      organization_id: ctx.organizationId,
      entity_type: meta.data.entity_type,
      entity_id: meta.data.entity_id,
      kind: meta.data.kind,
      document_url: path,
      created_by: ctx.userId,
    })
    .select('id')
    .single();
  if (error || !data) return { error: 'Enregistrement du document impossible.' };
  revalidatePath('/admin/conformite');
  revalidatePath('/admin/chauffeurs');
  revalidatePath('/admin/vehicules');
  return { success: true, path, id: (data as { id: string }).id };
}

/**
 * Génère une URL SIGNÉE courte pour lire un justificatif (bucket privé). La RLS
 * Storage (org + rôle) borne l'accès ; on revérifie côté applicatif que le
 * chemin appartient à l'organisation (défense en profondeur). Aucune URL
 * publique permanente n'est exposée.
 */
export async function getComplianceDocumentUrlAction(
  path: string,
): Promise<{ url?: string; error?: string }> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès non autorisé.' };
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    !pathBelongsToOrg(path, ctx.organizationId)
  ) {
    return { error: 'Document introuvable.' };
  }
  const { data, error } = await ctx.supabase.storage
    .from(COMPLIANCE_BUCKET)
    .createSignedUrl(path, COMPLIANCE_SIGNED_URL_TTL);
  if (error || !data) return { error: 'Document indisponible.' };
  return { url: data.signedUrl };
}
