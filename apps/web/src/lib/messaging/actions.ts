'use server';

/**
 * Server Actions — messagerie interne lot 1 (Phase 06.41, DEC-120).
 *
 * Pattern (CLAUDE.md § 10) : guard auth → zod safeParse → INSERT. La RLS
 * Postgres (`internal_message_insert`) reste l'autorité (defense in depth) :
 * elle impose org, `sender_profile_id = auth.uid()`, `sender_role` cohérent,
 * et qu'un chauffeur n'écrive que sur SES courses. L'INSERT renvoie la ligne
 * créée — une absence de ligne = rejet RLS silencieux remonté en erreur
 * explicite (esprit DEC-041, sans message technique brut).
 *
 * Le Realtime propage la nouvelle ligne aux abonnés ; on ne `revalidatePath`
 * pas (le fil est temps réel côté client).
 */

import { z } from 'zod';
import type { GeneralMessage, RideMessage } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import {
  MESSAGE_ATTACHMENTS_BUCKET,
  MESSAGE_IMAGE_ALLOWED_MIME,
  MESSAGE_IMAGE_MAX_BYTES,
  MESSAGE_IMAGE_SIGNED_URL_TTL,
  buildMessageImagePath,
} from '@/lib/storage/message-attachments';
import { getRideMessages } from './get-ride-messages';
import { getGeneralMessages } from './get-general-messages';

export type SendMessageState = { success?: boolean; error?: string };

// §5.22 lot 3 : un message porte AU MOINS du texte OU une photo (chemin d'objet).
const sendSchema = z
  .object({
    rideId: z.string().uuid(),
    body: z.string().trim().max(2000, 'Message trop long (2000 max).').optional(),
    imagePath: z.string().min(1).max(500).optional(),
  })
  .refine((v) => (v.body !== undefined && v.body.length > 0) || v.imagePath !== undefined, {
    message: 'Message vide.',
    path: ['body'],
  });

/**
 * Liste les messages d'une course (wrapper Server Action de la query
 * `'server-only'`). Permet au hook client le fetch initial + le refetch au
 * resubscribe Realtime. La RLS fait le cloisonnement.
 */
export async function getRideMessagesAction(
  rideId: string,
): Promise<{ messages: RideMessage[]; error?: string }> {
  if (!z.string().uuid().safeParse(rideId).success) {
    return { messages: [], error: 'Course invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { messages: [], error: 'Session expirée. Reconnectez-vous.' };

  const messages = await getRideMessages(rideId);
  return { messages };
}

/**
 * Envoie un message sur une course. Tout membre de l'organisation peut écrire
 * (régulateur, dirigeant, chauffeur) ; la RLS restreint le chauffeur à ses
 * propres courses et empêche l'usurpation d'auteur/rôle.
 */
export async function sendRideMessageAction(
  rideId: string,
  body: string,
  imagePath?: string,
): Promise<SendMessageState> {
  const parsed = sendSchema.safeParse({
    rideId,
    body: body.length > 0 ? body : undefined,
    imagePath,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Message invalide.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const bodyValue =
    parsed.data.body !== undefined && parsed.data.body.length > 0 ? parsed.data.body : null;

  const { data, error } = await ctx.supabase
    .from('internal_message')
    .insert({
      organization_id: ctx.organizationId,
      ride_id: parsed.data.rideId,
      sender_profile_id: ctx.userId,
      sender_role: ctx.role,
      body: bodyValue,
      image_path: parsed.data.imagePath ?? null,
    })
    .select('id');

  if (error) return { error: 'Envoi impossible. Vérifiez que la course vous est accessible.' };
  if (!data || (data as { id: string }[]).length === 0) {
    return { error: 'Envoi refusé : course non accessible.' };
  }
  return { success: true };
}

/**
 * Téléverse une PHOTO de message sur le bucket privé org-scoped (§5.22 lot 3) —
 * validation SERVEUR (MIME image liste blanche, taille, présence) + vérification
 * que la course est accessible (RLS) pour éviter tout upload orphelin hors
 * périmètre. Renvoie le CHEMIN de l'objet (à joindre au message). Aucune URL
 * publique — la lecture passe par `getMessageImageUrlAction`.
 */
export async function uploadMessageImageAction(
  formData: FormData,
): Promise<{ path?: string; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const rideId = formData.get('ride_id');
  if (typeof rideId !== 'string' || !z.string().uuid().safeParse(rideId).success) {
    return { error: 'Course invalide.' };
  }
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Aucune image reçue.' };
  if (!(MESSAGE_IMAGE_ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return { error: 'Format non accepté. Images JPEG, PNG ou WebP.' };
  }
  if (file.size > MESSAGE_IMAGE_MAX_BYTES) {
    return { error: 'Image trop volumineuse (5 Mo maximum).' };
  }

  // La course doit être visible de l'appelant (RLS) — sinon upload refusé.
  const rideRes = await ctx.supabase.from('rides').select('id').eq('id', rideId).maybeSingle();
  if (rideRes.error || !rideRes.data) return { error: 'Course non accessible.' };

  const path = buildMessageImagePath({
    organizationId: ctx.organizationId,
    rideId,
    filename: file.name,
    uuid: crypto.randomUUID(),
  });
  const up = await ctx.supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return { error: 'Téléversement impossible.' };
  return { path };
}

/**
 * URL signée courte pour lire la photo d'un message (bucket privé, §5.22 lot 3).
 * La RLS `internal_message_select` est le garde-fou : on ne récupère le chemin
 * que si l'appelant peut voir le message ; l'URL signée n'est jamais publique.
 */
export async function getMessageImageUrlAction(
  messageId: string,
): Promise<{ url?: string; error?: string }> {
  if (!z.string().uuid().safeParse(messageId).success) return { error: 'Message invalide.' };
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const res = await ctx.supabase
    .from('internal_message')
    .select('image_path')
    .eq('id', messageId)
    .maybeSingle();
  if (res.error || !res.data) return { error: 'Message introuvable.' };
  const path = (res.data as { image_path: string | null }).image_path;
  if (!path) return { error: 'Aucune image.' };

  const signed = await ctx.supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(path, MESSAGE_IMAGE_SIGNED_URL_TTL);
  if (signed.error || !signed.data) return { error: 'Image indisponible.' };
  return { url: signed.data.signedUrl };
}

// =============================================================================
// Fil général (hors course, §5.22 lot A)
// =============================================================================

const generalBodySchema = z
  .string()
  .trim()
  .min(1, 'Message vide.')
  .max(2000, 'Message trop long (2000 max).');

/**
 * Liste le fil général de l'organisation (wrapper Server Action de la query
 * `'server-only'`). La RLS `internal_general_message_select` cloisonne par org.
 */
export async function getGeneralMessagesAction(): Promise<{
  messages: GeneralMessage[];
  error?: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx) return { messages: [], error: 'Session expirée. Reconnectez-vous.' };

  const messages = await getGeneralMessages();
  return { messages };
}

/**
 * Envoie un message sur le fil général de l'organisation. Tout membre de l'org
 * (régulateur, dirigeant, chauffeur) peut écrire ; la RLS impose org, auteur =
 * soi (anti-usurpation) et rôle cohérent.
 */
export async function sendGeneralMessageAction(body: string): Promise<SendMessageState> {
  const parsed = generalBodySchema.safeParse(body);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Message invalide.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const { data, error } = await ctx.supabase
    .from('internal_general_message')
    .insert({
      organization_id: ctx.organizationId,
      sender_profile_id: ctx.userId,
      sender_role: ctx.role,
      body: parsed.data,
    })
    .select('id');

  if (error) return { error: 'Envoi impossible. Réessayez.' };
  if (!data || (data as { id: string }[]).length === 0) {
    return { error: 'Envoi refusé.' };
  }
  return { success: true };
}
