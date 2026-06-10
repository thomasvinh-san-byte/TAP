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
import { complianceItemUpsertSchema, type ComplianceEntityType } from '@tap/shared';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

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
    .from('organizations' as never)
    .update({ compliance_blocking_mode: parsed.data } as never)
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
      .from('compliance_items' as never)
      .update(payload as never)
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
    return { success: true, id: v.id };
  }

  const { data, error } = await ctx.supabase
    .from('compliance_items' as never)
    .insert({
      ...payload,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
    } as never)
    .select('id')
    .single();

  if (error || !data) return { error: 'Création échéance impossible.' };
  revalidatePath('/admin/conformite');
  revalidatePath('/admin/chauffeurs');
  revalidatePath('/admin/vehicules');
  return { success: true, id: (data as { id: string }).id };
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
    .from('compliance_items' as never)
    .update({ archive: true, archive_at: new Date().toISOString() } as never)
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
    .from('compliance_items' as never)
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
 * Échafaudage upload de document justificatif (Phase 06.63, DEC-143).
 *
 * STUB EXPLICITE : le bucket de stockage HDS n'existe pas encore (registre §1.1,
 * Phase 09). On ne câble AUCUN Storage, on ne renvoie PAS de faux `document_url`.
 * L'UI d'upload (flag `UPLOAD_DOCS_ENABLED` ON, dev) appelle cette action qui
 * échoue clairement. Le vrai `.upload()` Supabase Storage sera branché quand le
 * bucket HDS + RLS Storage existeront.
 */
export async function uploadComplianceDocumentAction(
  _formData: FormData,
): Promise<{ error: string }> {
  return {
    error:
      'Téléversement indisponible : hébergement sécurisé (HDS) non configuré. Prévu en Phase 09.',
  };
}
