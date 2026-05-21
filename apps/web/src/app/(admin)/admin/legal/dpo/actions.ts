'use server';

/**
 * Server Action — édition contact DPO (D-15).
 * Pattern : zod (dpoContactSchema) → auth → UPDATE organizations → revalidate.
 * RLS dirigeant only sur organizations.
 */

import { revalidatePath } from 'next/cache';
import { dpoContactSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

export type ActionState = { error?: string; success?: boolean };

function parseDpoForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return dpoContactSchema.safeParse({
    dpo_contact_email: raw.dpo_contact_email?.trim() || null,
    dpo_contact_phone: raw.dpo_contact_phone?.trim() || null,
    dpo_contact_address: raw.dpo_contact_address?.trim() || null,
    dpo_external: raw.dpo_external === 'on',
  });
}

export async function updateDpoContactAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseDpoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return { error: 'Profil introuvable.' };

  const data = parsed.data;
  const { error } = await supabase
    .from('organizations')
    .update({
      dpo_contact_email: data.dpo_contact_email ?? null,
      dpo_contact_phone: data.dpo_contact_phone ?? null,
      dpo_contact_address: data.dpo_contact_address ?? null,
      dpo_external: data.dpo_external,
      dpo_updated_at: new Date().toISOString(),
    } as never)
    .eq('id', profile.organization_id);

  if (error) return { error: 'Modification impossible.' };

  revalidatePath('/admin/legal/dpo');
  revalidatePath('/legal/dpo');
  return { success: true };
}
