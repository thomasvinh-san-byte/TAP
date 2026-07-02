import 'server-only';
import { getAuthContext } from '@/lib/auth/get-auth-context';

/**
 * Relevé kilométrique du jour du chauffeur (PWA-04, §5.16).
 *
 */

const REUNION_OFFSET_HOURS = 4;

/** Date locale Réunion du jour (AAAA-MM-JJ). */
export function reunionTodayDate(now = new Date()): string {
  return new Date(now.getTime() + REUNION_OFFSET_HOURS * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface TodayMileage {
  jour: string;
  km_start: number | null;
  km_end: number | null;
}

export async function getTodayMileage(): Promise<TodayMileage> {
  const jour = reunionTodayDate();
  const ctx = await getAuthContext();
  if (!ctx || ctx.role !== 'chauffeur') return { jour, km_start: null, km_end: null };

  const { data } = await ctx.supabase
    .from('driver_daily_mileage')
    .select('km_start, km_end')
    .eq('driver_id', ctx.userId)
    .eq('jour', jour)
    .maybeSingle();

  const row = (data as { km_start: number | null; km_end: number | null } | null) ?? null;
  return { jour, km_start: row?.km_start ?? null, km_end: row?.km_end ?? null };
}
