import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { generateOccurrences, toIsoDate } from '@tap/recurrence';
import { buildRidesPayload } from '@/lib/recurrence/build-rides-payload';
import { selectMissingOccurrences } from '@/lib/recurrence/select-missing-occurrences';
import type { Database } from '@tap/database';

/**
 * Cron — génération anticipée des courses récurrentes (RECURRENCE-01, §5.9).
 *
 * Étend chaque jour l'horizon des séries actives : matérialise les occurrences
 * manquantes jusqu'à aujourd'hui + N jours (défaut 14), de façon IDEMPOTENTE.
 * Réutilise `generateOccurrences` (@tap/recurrence) et `buildRidesPayload`
 * (transform partagé create/update). Déclenché par pg_cron + pg_net + Vault
 * (même mécanisme que les crons SMS), jamais par Vercel cron.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LOT PARTIEL ASSUMÉ — §5.9 N'EST PAS COMPLET APRÈS CE LOT.
 * Ce cron couvre UNIQUEMENT la génération anticipée. NE SONT PAS couverts :
 *   - surcharge d'occurrence (modifier une occurrence isolée sans la série) ;
 *   - édition de série à compter d'une date / suspension temporaire ;
 *   - renouvellement (fin de série, bon de transport épuisé) — dépend du
 *     module prescriptions §5.3.
 * Ne pas considérer la récurrence comme terminée sur la base de ce cron.
 * ─────────────────────────────────────────────────────────────────────────
 */
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * Horizon de génération (jours). §5.9 : paramétrable, défaut 14. Surchargable
 * via la variable d'environnement RECURRENCE_HORIZON_DAYS (entier positif).
 */
const DEFAULT_HORIZON_DAYS = 14;
const REUNION_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC+4, pas de DST

function horizonDays(): number {
  const raw = Number(process.env.RECURRENCE_HORIZON_DAYS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_HORIZON_DAYS;
}

function adminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Date locale Réunion (YYYY-MM-DD) d'un instant. */
function reunionDate(d: Date): string {
  return new Date(d.getTime() + REUNION_OFFSET_MS).toISOString().slice(0, 10);
}

interface RecurrenceRow {
  id: string;
  organization_id: string;
  patient_id: string;
  rrule_str: string;
  start_date: string;
  end_date: string | null;
  pickup_address: string;
  dropoff_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_citycode: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_citycode: string | null;
  transport_mode: 'vsl' | 'taxi_conventionne' | 'tpmr';
  urgency: string;
}

async function fetchHolidays(supabase: SupabaseClient<Database>): Promise<Set<string>> {
  const res = await supabase.from('holidays_974' as never).select('date');
  if (res.error || !res.data) return new Set();
  return new Set((res.data as { date: string }[]).map((r) => r.date));
}

/** Dates (YYYY-MM-DD) exclues d'une série (table d'exceptions). */
async function fetchExcluded(
  supabase: SupabaseClient<Database>,
  recurrenceId: string,
): Promise<Set<string>> {
  const res = await supabase
    .from('ride_recurrence_exceptions')
    .select('excluded_date')
    .eq('ride_recurrence_id', recurrenceId);
  if (res.error || !res.data) return new Set();
  return new Set((res.data as { excluded_date: string }[]).map((r) => r.excluded_date));
}

/**
 * Dates déjà matérialisées pour une série (clé = date UTC de l'occurrence),
 * dans la fenêtre [now, …]. Sert l'idempotence : on ne réinsère pas une date
 * déjà présente. On ne lit que le futur (les passées ne sont jamais régénérées).
 */
async function fetchExistingDates(
  supabase: SupabaseClient<Database>,
  recurrenceId: string,
  fromIso: string,
): Promise<Set<string>> {
  const res = await supabase
    .from('rides')
    .select('scheduled_at')
    .eq('ride_recurrence_id', recurrenceId)
    .gte('scheduled_at', fromIso);
  if (res.error || !res.data) return new Set();
  return new Set(
    (res.data as { scheduled_at: string }[]).map((r) => toIsoDate(new Date(r.scheduled_at))),
  );
}

/** Matérialise les occurrences manquantes d'une série jusqu'à l'horizon. */
async function materializeRecurrence(
  supabase: SupabaseClient<Database>,
  rec: RecurrenceRow,
  horizonEnd: Date,
  todayMs: number,
  holidays974: Set<string>,
): Promise<number> {
  // Anchor RRULE = start_date 08:00 (convention create/update) — préservée pour
  // que les occurrences cron s'alignent exactement sur celles des actions.
  const dtstart = new Date(`${rec.start_date}T08:00:00`);
  const excludedDates = await fetchExcluded(supabase, rec.id);

  let occurrences: Date[];
  try {
    occurrences = generateOccurrences({
      rruleStr: rec.rrule_str,
      dtstart,
      until: horizonEnd,
      holidays974,
      excludedDates,
    });
  } catch {
    return 0; // règle invalide : on saute la série sans casser le cron
  }

  const existing = await fetchExistingDates(supabase, rec.id, new Date(todayMs).toISOString());
  // Idempotence : futures + non déjà matérialisées (cœur pur testé).
  const missing = selectMissingOccurrences(occurrences, existing, todayMs);
  if (missing.length === 0) return 0;

  const payload = buildRidesPayload(
    missing,
    rec.id,
    { organizationId: rec.organization_id, userId: null },
    {
      patient_id: rec.patient_id,
      pickup_address: rec.pickup_address,
      dropoff_address: rec.dropoff_address,
      transport_mode: rec.transport_mode,
      urgency: rec.urgency === 'prioritaire' ? 'prioritaire' : 'normale',
    },
    { lat: rec.pickup_lat, lng: rec.pickup_lng, citycode: rec.pickup_citycode },
    { lat: rec.dropoff_lat, lng: rec.dropoff_lng, citycode: rec.dropoff_citycode },
  );

  const ins = await supabase.from('rides').insert(payload as never);
  if (ins.error) {
    console.error(`[cron recurrences] insert échoué (série ${rec.id}):`, ins.error.message);
    return 0;
  }
  return missing.length;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_APP_TOKEN;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminSupabase();
  const now = new Date();
  const todayMs = now.getTime();
  const today = reunionDate(now);
  const horizonEnd = new Date(todayMs + horizonDays() * 24 * 60 * 60 * 1000);
  const horizon = reunionDate(horizonEnd);

  // Séries actives : non archivées, dont la période couvre l'horizon.
  const recRes = await supabase
    .from('ride_recurrences')
    .select(
      'id, organization_id, patient_id, rrule_str, start_date, end_date, ' +
        'pickup_address, dropoff_address, pickup_lat, pickup_lng, pickup_citycode, ' +
        'dropoff_lat, dropoff_lng, dropoff_citycode, transport_mode, urgency',
    )
    .is('archived_at', null)
    .lte('start_date', horizon)
    .or(`end_date.is.null,end_date.gte.${today}`);
  if (recRes.error) {
    return NextResponse.json({ error: recRes.error.message }, { status: 500 });
  }
  const recurrences = (recRes.data as unknown as RecurrenceRow[] | null) ?? [];

  const holidays974 = await fetchHolidays(supabase);

  let created = 0;
  for (const rec of recurrences) {
    created += await materializeRecurrence(supabase, rec, horizonEnd, todayMs, holidays974);
  }

  return NextResponse.json({
    series: recurrences.length,
    created,
    horizon_days: horizonDays(),
  });
}
