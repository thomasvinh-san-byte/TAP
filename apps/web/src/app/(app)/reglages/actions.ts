'use server';

/**
 * Server Actions de la page Réglages (DEC-149).
 *
 * `updateNotificationPreferencesAction` upsert la ligne de préférences de
 * l'utilisateur courant (PK user_id, lazy : créée au 1er changement). RLS
 * `user_id = auth.uid()` garantit qu'un user ne touche QUE ses préférences ;
 * `requireAuth` (getAuthContext) en defense in depth.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/get-auth-context';

export type NotificationPreferencesState = {
  success?: boolean;
  error?: string;
};

const cockpitAlertPreferencesSchema = z.object({
  patient_no_show: z.boolean(),
  sms_failed: z.boolean(),
  ride_delayed: z.boolean(),
});

export async function updateNotificationPreferencesAction(
  input: z.infer<typeof cockpitAlertPreferencesSchema>,
): Promise<NotificationPreferencesState> {
  const parsed = cockpitAlertPreferencesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Préférences invalides.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const { error } = await ctx.supabase.from('notification_preferences').upsert(
    {
      user_id: ctx.userId,
      organization_id: ctx.organizationId,
      alert_patient_no_show: parsed.data.patient_no_show,
      alert_sms_failed: parsed.data.sms_failed,
      alert_ride_delayed: parsed.data.ride_delayed,
    },
    { onConflict: 'user_id' },
  );

  if (error) return { error: 'Enregistrement des préférences impossible.' };

  // Le cockpit lit les préférences côté serveur (force-dynamic) → l'effet est
  // visible au prochain rendu de /cockpit.
  revalidatePath('/cockpit');
  revalidatePath('/reglages');
  return { success: true };
}
