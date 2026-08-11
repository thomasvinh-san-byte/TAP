'use server';

/**
 * Server Actions — suivi des factures CGSS (G3 Lot 2, périmètre A déclaratif).
 *
 * Enregistre un RETOUR (télétransmission, ARL, retour NOEMIE) saisi manuellement
 * par le gestionnaire : insère l'événement append-only ET met à jour le statut
 * de la course, atomiquement, via la RPC `record_cgss_invoice_event` (SECURITY
 * INVOKER — RLS + contraintes Lot 1 appliquées). Aucun montant (D-09).
 *
 * Réservé au dirigeant (le module `/admin/facturation` est dirigeant-only).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import {
  CGSS_EVENT_TYPES,
  CGSS_MOTIF_FAMILLES,
  EVENT_TO_STATUS,
  isRejectEvent,
  type CgssEventType,
} from './_lib/cgss-invoice-status';

export type RecordCgssEventState = { success?: true; error?: string };

const inputSchema = z
  .object({
    rideId: z.string().uuid(),
    eventType: z.enum(CGSS_EVENT_TYPES),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).'),
    motif: z.string().trim().min(1).max(500).optional(),
    motifFamille: z.enum(CGSS_MOTIF_FAMILLES).optional(),
    complementaireEnAttente: z.boolean().optional(),
  })
  // Contraintes Lot 1 rejouées côté application (defense in depth vs check DB) :
  // un rejet exige un motif ; la famille de motif ne s'applique qu'aux rejets.
  .refine((v) => !isRejectEvent(v.eventType) || !!v.motif, {
    message: 'Un rejet doit indiquer un motif.',
    path: ['motif'],
  })
  .refine((v) => v.motifFamille === undefined || isRejectEvent(v.eventType), {
    message: 'La famille de motif ne s’applique qu’à un rejet.',
    path: ['motifFamille'],
  });

export async function recordCgssEventAction(
  args: z.infer<typeof inputSchema>,
): Promise<RecordCgssEventState> {
  const parsed = inputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Retour invalide.' };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const eventType = parsed.data.eventType as CgssEventType;
  const newStatus = EVENT_TO_STATUS[eventType];

  const { error } = await ctx.supabase.rpc('record_cgss_invoice_event', {
    p_ride_id: parsed.data.rideId,
    p_event_type: eventType,
    p_event_date: parsed.data.eventDate,
    p_new_status: newStatus,
    p_motif: parsed.data.motif ?? null,
    p_motif_famille: parsed.data.motifFamille ?? null,
    p_complementaire_en_attente: parsed.data.complementaireEnAttente ?? false,
  });
  if (error) return { error: 'Enregistrement du retour impossible.' };

  revalidatePath('/admin/facturation');
  return { success: true };
}
