import 'server-only';

/**
 * Envoi de notifications Web Push (PWA chauffeur, DEC-167).
 *
 * BEST-EFFORT : appelé depuis les Server Actions d'affectation/réaffectation
 * APRÈS l'action métier. Un échec d'envoi ne fait JAMAIS échouer ni rollback
 * l'action (pattern 10.02) — toute erreur est loggée, jamais propagée.
 *
 * Secrets : `VAPID_PRIVATE_KEY` reste serveur ; `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
 * est exposée au client (pour `subscribe`). Sans clés configurées → no-op
 * gracieux (dev/preview sans VAPID ne plante pas).
 *
 * Client service-role : `push_subscriptions` est RLS user-scoped (un régulateur
 * ne peut pas lire les subs d'un chauffeur) → comme les crons SMS, on lit/écrit
 * via service-role avec filtre explicite `user_id` + `organization_id`.
 */

import webpush from 'web-push';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:contact@tap-reunion.re',
      publicKey,
      privateKey,
    );
    vapidConfigured = true;
  }
  return true;
}

// Client service-role NON typé : `push_subscriptions` / `push_enabled` ne sont
// pas (encore) dans types.gen.ts → typage souple, casts explicites des résultats.
function adminSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Envoie une notification à tous les abonnements d'un utilisateur (respecte
 * `push_enabled`). Best-effort total. Nettoie les abonnements expirés (410/404).
 */
export async function sendPushToUser(
  userId: string,
  organizationId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!ensureVapid()) return;
    const supabase = adminSupabase();

    // Respecter la préférence push (absence de ligne = défaut activé).
    const prefRes = await supabase
      .from('notification_preferences')
      .select('push_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    const pref = prefRes.data as { push_enabled: boolean } | null;
    if (pref && pref.push_enabled === false) return;

    const subsRes = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId)
      .eq('organization_id', organizationId);
    const subs = (subsRes.data as SubRow[] | null) ?? [];
    if (subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          // 404/410 = abonnement expiré → nettoyage (pas d'accumulation de subs morts).
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id);
          } else {
            console.error('[push] envoi échoué:', err);
          }
        }
      }),
    );
  } catch (err) {
    console.error('[push] échec global (best-effort):', err);
  }
}

/**
 * Envoie une notification au CHAUFFEUR (résout `drivers.profile_id` → user).
 * Best-effort : un chauffeur sans compte lié (profile_id null) est ignoré.
 */
export async function sendPushToDriver(
  driverId: string,
  organizationId: string,
  payload: PushPayload,
): Promise<void> {
  try {
    const supabase = adminSupabase();
    const { data } = await supabase
      .from('drivers')
      .select('profile_id')
      .eq('id', driverId)
      .maybeSingle();
    const profileId = (data as { profile_id: string | null } | null)?.profile_id ?? null;
    if (!profileId) return;
    await sendPushToUser(profileId, organizationId, payload);
  } catch (err) {
    console.error('[push] résolution chauffeur échouée (best-effort):', err);
  }
}
