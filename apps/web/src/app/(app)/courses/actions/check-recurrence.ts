'use server';

/**
 * Server Action de SUGGESTION de récurrence en saisie express (CdG §5.8,
 * EXPRESS-02). Calquée sur `check-duplicate.ts` : lecture seule, non bloquante.
 *
 * Détecte les récurrences ACTIVES du patient (non archivées, plage couvrant le
 * jour) qui produisent une occurrence le jour (Réunion) du créneau saisi —
 * exceptions et jours fériés respectés. Le résultat alimente la bannière
 * INFORMATIVE `<RecurrenceBanner>` : « [Patient] a un transport récurrent
 * aujourd'hui… est-ce le même ? ». La régulatrice tranche (Pilier 1).
 *
 * Sécurité : `getAuthContext()` + whitelist REGULATEUR_OR_DIRIGEANT ; RLS
 * Postgres scope l'org. Logique de match déléguée à `recurrenceFallsOnDay`
 * (pure, testée) — réutilise `generateOccurrences` (expansion RRULE).
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { getHolidays974 } from '@/lib/pricing/get-active-tariff-grid';
import { recurrenceFallsOnDay } from '@/lib/recurrence/match-recurrence-day';
import { REGULATEUR_OR_DIRIGEANT } from './_shared';

const checkRecurrenceInputSchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
});

export type RecurrenceMatch = {
  id: string;
  dropoff_address: string;
  transport_mode: string;
};

interface RecurrenceRow {
  id: string;
  rrule_str: string;
  start_date: string;
  end_date: string | null;
  dropoff_address: string;
  transport_mode: string;
}

export async function checkRecurrenceSuggestionAction(
  input: z.infer<typeof checkRecurrenceInputSchema>,
): Promise<{ data?: RecurrenceMatch[]; error?: string }> {
  const parsed = checkRecurrenceInputSchema.safeParse(input);
  if (!parsed.success) return { error: 'Paramètres invalides.' };

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as never)) {
    return { error: 'Accès non autorisé.' };
  }

  const recRes = await ctx.supabase
    .from('ride_recurrences')
    .select('id, rrule_str, start_date, end_date, dropoff_address, transport_mode')
    .eq('patient_id', parsed.data.patientId)
    .is('archived_at', null);
  if (recRes.error) return { error: 'Vérification récurrence indisponible.' };

  const recurrences = (recRes.data as unknown as RecurrenceRow[] | null) ?? [];
  if (recurrences.length === 0) return { data: [] };

  // Exceptions des récurrences candidates (1 requête, anti-N+1).
  const ids = recurrences.map((r) => r.id);
  const excRes = await ctx.supabase
    .from('ride_recurrence_exceptions')
    .select('ride_recurrence_id, excluded_date')
    .in('ride_recurrence_id', ids);
  const exByRec = new Map<string, Set<string>>();
  for (const e of (excRes.data as { ride_recurrence_id: string; excluded_date: string }[] | null) ??
    []) {
    const set = exByRec.get(e.ride_recurrence_id) ?? new Set<string>();
    set.add(e.excluded_date);
    exByRec.set(e.ride_recurrence_id, set);
  }

  const holidays974 = new Set(await getHolidays974());
  const scheduled = new Date(parsed.data.scheduledAt);

  const matches = recurrences
    .filter((r) =>
      recurrenceFallsOnDay(
        {
          rruleStr: r.rrule_str,
          startDate: r.start_date,
          endDate: r.end_date,
          excludedDates: exByRec.get(r.id) ?? new Set<string>(),
          holidays974,
        },
        scheduled,
      ),
    )
    .map((r) => ({
      id: r.id,
      dropoff_address: r.dropoff_address,
      transport_mode: r.transport_mode,
    }));

  return { data: matches };
}
