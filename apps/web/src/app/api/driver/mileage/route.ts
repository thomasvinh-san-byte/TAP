import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDriverFromRouteHandler } from '@/lib/api/driver-auth';

/**
 * POST /api/driver/mileage — relevé kilométrique journalier (PWA-04, §5.16).
 *
 * Saisie du compteur en début (`km_start`) ou en fin (`km_end`) de journée.
 * Un relevé par chauffeur et par jour (garde d'unicité en base). L'écriture est
 * naturellement idempotente (upsert par organisation + chauffeur + jour) : pas
 * besoin de la table d'idempotence des transitions de course — rejouable tel
 * quel par la file hors-ligne.
 *
 * Fusion : on ne remet PAS à null le champ non fourni (saisir `km_end` le soir
 * ne doit pas effacer le `km_start` du matin) → lecture puis upsert fusionné.
 *
 * Isolation : `requireDriverFromRouteHandler` (rôle chauffeur) + RLS
 * `driver_id = auth.uid()`. `driver_id` = profiles.id (auth.uid()).
 */

const payloadSchema = z
  .object({
    idempotency_key: z.string().uuid().optional(),
    jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.'),
    km_start: z.number().int().min(0).max(9_999_999).optional(),
    km_end: z.number().int().min(0).max(9_999_999).optional(),
  })
  .refine((v) => v.km_start !== undefined || v.km_end !== undefined, {
    message: 'Renseignez le kilométrage de début ou de fin.',
  });

interface MileageRow {
  id: string;
  km_start: number | null;
  km_end: number | null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' },
      { status: 400 },
    );
  }

  const auth = await requireDriverFromRouteHandler();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const driverId = auth.ctx.userId; // profiles.id = auth.uid()
  const { jour, km_start, km_end } = parsed.data;

  // Lecture du relevé existant du jour (RLS scope l'org + le chauffeur).
  const { data: existing } = await auth.ctx.supabase
    .from('driver_daily_mileage')
    .select('id, km_start, km_end')
    .eq('driver_id', driverId)
    .eq('jour', jour)
    .maybeSingle();
  const current = (existing as MileageRow | null) ?? null;

  const mergedStart = km_start ?? current?.km_start ?? null;
  const mergedEnd = km_end ?? current?.km_end ?? null;

  if (mergedStart !== null && mergedEnd !== null && mergedEnd < mergedStart) {
    return NextResponse.json(
      { error: 'Le kilométrage de fin doit être supérieur ou égal à celui de début.' },
      { status: 400 },
    );
  }

  const { error } = await auth.ctx.supabase.from('driver_daily_mileage').upsert(
    {
      organization_id: auth.ctx.organizationId,
      driver_id: driverId,
      jour,
      km_start: mergedStart,
      km_end: mergedEnd,
    },
    { onConflict: 'organization_id,driver_id,jour' },
  );

  if (error) {
    return NextResponse.json(
      { error: 'Enregistrement du kilométrage impossible.' },
      { status: 500 },
    );
  }

  revalidatePath('/kilometrage');
  revalidatePath('/conduite');
  return NextResponse.json({ success: true });
}
