import 'server-only';
import { getAuthContext, type AuthContext } from '@/lib/auth/get-auth-context';

/**
 * Historique des tournées passées du chauffeur (PWA-04, §5.16).
 *
 * Pas de table `tournee` en base : une « tournée » = l'ensemble des courses
 * d'un chauffeur sur une journée. On dérive donc l'historique depuis `rides`,
 * groupé par date locale Réunion (UTC+4). Lecture seule, borné à 90 jours.
 *
 * Sécurité : RLS same-org + filtre applicatif `driver_id = mon driver`
 * (même posture que `listMyRidesUpcoming`). Le chauffeur ne voit que ses
 * propres tournées.
 */

const REUNION_OFFSET_HOURS = 4;
const HISTORY_WINDOW_DAYS = 90;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Début de la journée courante en TZ Indian/Reunion, exprimé en UTC (ISO). */
function reunionTodayStartIso(now = new Date()): string {
  const reunionNow = new Date(now.getTime() + REUNION_OFFSET_HOURS * MS_PER_HOUR);
  const startUtcMs =
    Date.UTC(reunionNow.getUTCFullYear(), reunionNow.getUTCMonth(), reunionNow.getUTCDate()) -
    REUNION_OFFSET_HOURS * MS_PER_HOUR;
  return new Date(startUtcMs).toISOString();
}

/** Date locale Réunion (AAAA-MM-JJ) d'un instant ISO. */
function reunionLocalDate(iso: string): string {
  return new Date(new Date(iso).getTime() + REUNION_OFFSET_HOURS * MS_PER_HOUR)
    .toISOString()
    .slice(0, 10);
}

export interface PastTourneeDay {
  /** Date locale Réunion, AAAA-MM-JJ. */
  date: string;
  total: number;
  terminees: number;
  annulees: number;
}

async function resolveMyDriverId(ctx: AuthContext): Promise<string | null> {
  const res = await ctx.supabase
    .from('drivers')
    .select('id')
    .eq('profile_id', ctx.userId)
    .eq('organization_id', ctx.organizationId)
    .eq('archive', false)
    .maybeSingle();
  return ((res.data as { id: string } | null) ?? null)?.id ?? null;
}

export async function listMyPastTournees(): Promise<PastTourneeDay[]> {
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'chauffeur') return [];

  const myDriverId = await resolveMyDriverId(ctx);
  if (!myDriverId) return [];

  const todayStart = reunionTodayStartIso();
  const since = new Date(
    new Date(todayStart).getTime() - HISTORY_WINDOW_DAYS * MS_PER_DAY,
  ).toISOString();

  const { data, error } = await ctx.supabase
    .from('rides')
    .select('scheduled_at, status')
    // `driver_id` absent de types.gen.ts jusqu'au resync → cast (DEC-155),
    // même pattern que listMyRidesUpcoming.
    .eq('driver_id', myDriverId)
    .gte('scheduled_at', since)
    .lt('scheduled_at', todayStart)
    .eq('archive', false)
    .order('scheduled_at', { ascending: false })
    .limit(1000);

  if (error || !data) return [];

  const rows = data as unknown as { scheduled_at: string; status: string }[];
  const byDay = new Map<string, PastTourneeDay>();
  for (const r of rows) {
    const day = reunionLocalDate(r.scheduled_at);
    const acc = byDay.get(day) ?? { date: day, total: 0, terminees: 0, annulees: 0 };
    acc.total += 1;
    if (r.status === 'terminee') acc.terminees += 1;
    else if (r.status.startsWith('annulee')) acc.annulees += 1;
    byDay.set(day, acc);
  }

  // Chronologique inverse (le plus récent d'abord).
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
