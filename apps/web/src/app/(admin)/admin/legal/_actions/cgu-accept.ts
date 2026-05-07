'use server';

/**
 * Server Action acceptance CGU (D-13).
 * INSERT cgu_acceptance + UPDATE profiles.cgu_version_accepted.
 * Audit log automatique via trigger DB.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error?: string; success?: boolean };

export async function acceptCguAction(version: string): Promise<ActionState> {
  if (!version || version.length > 50) {
    return { error: 'Version CGU invalide.' };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const now = new Date().toISOString();

  const { error: insertError } = await supabase
    .from('cgu_acceptance')
    .insert({
      profile_id: user.id,
      version,
      document_type: 'cgu',
      accepted_at: now,
    } as never);

  if (insertError) return { error: 'Acceptation impossible.' };

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      cgu_version_accepted: version,
      cgu_accepted_at: now,
    } as never)
    .eq('id', user.id);

  if (updateError) return { error: 'Mise à jour profil impossible.' };

  revalidatePath('/admin/legal');
  return { success: true };
}
