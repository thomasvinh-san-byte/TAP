'use server';

/**
 * Server Action de détection de doublons de course (Phase 03.1 / B3).
 *
 * Critères (CdG §5.8 ; révise D-B3-2 qui figeait ±30 min — EXPRESS-01) :
 *   - même `patient_id`
 *   - `scheduled_at` dans la fenêtre [scheduledAt − 2 h, scheduledAt + 2 h]
 *     (±2h, conforme au cahier des charges §5.8 « course similaire à ±2h » ;
 *     filet plus large pour les créneaux imprécis — faux positifs assumés car
 *     la détection est NON bloquante : la régulatrice tranche)
 *   - `archive = false`
 *   - `status ∈ ACTIVE_RIDE_STATUSES` (source canonique — exclut les courses
 *     annulées et brouillons ; inclut arrive_sur_place / patient_a_bord)
 *   - en mode édition : exclut la course elle-même (`excludeRideId`)
 *
 * Lecture seule — pas de `revalidatePath`. Le résultat alimente le banner
 * amber non-bloquant `<DuplicateBanner>` dans le modal saisie express :
 * la régulatrice décide (Pilier 1, respect de l'expertise).
 *
 * Sécurité : `getAuthContext()` + whitelist rôle REGULATEUR_OR_DIRIGEANT
 * (defense in depth) ; le filtrage organisationnel reste assuré par RLS
 * Postgres (`rides_select_org` policy).
 */

import { z } from 'zod';
import { ACTIVE_RIDE_STATUSES } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { REGULATEUR_OR_DIRIGEANT } from './_shared';

const checkDuplicateInputSchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  excludeRideId: z.string().uuid().optional(),
});

export type DuplicateRide = {
  id: string;
  scheduled_at: string;
  status: string;
};

// CdG §5.8 : fenêtre ±2h (révise D-B3-2 ±30 min — EXPRESS-01).
const WINDOW_MS = 2 * 60 * 60 * 1000;

export async function checkDuplicateRideAction(
  input: z.infer<typeof checkDuplicateInputSchema>,
): Promise<{ data?: DuplicateRide[]; error?: string }> {
  const parsed = checkDuplicateInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: 'Paramètres invalides.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as never)) {
    return { error: 'Accès non autorisé.' };
  }

  const baseMs = new Date(parsed.data.scheduledAt).getTime();
  const fromIso = new Date(baseMs - WINDOW_MS).toISOString();
  const toIso = new Date(baseMs + WINDOW_MS).toISOString();

  let query = ctx.supabase
    .from('rides')
    .select('id, scheduled_at, status')
    .eq('patient_id', parsed.data.patientId)
    .eq('archive', false)
    .in('status', ACTIVE_RIDE_STATUSES as unknown as string[])
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso);

  if (parsed.data.excludeRideId) {
    query = query.neq('id', parsed.data.excludeRideId);
  }

  const { data, error } = await query;

  if (error) {
    return { error: 'Vérification doublon indisponible.' };
  }

  return { data: (data ?? []) as DuplicateRide[] };
}
