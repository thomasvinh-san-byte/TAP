import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { canTransition } from '@tap/shared';
import { requireDriverFromRouteHandler } from '@/lib/api/driver-auth';
import { withIdempotency } from '@/lib/api/idempotency';
import { notifyPickupConfirmed } from '@/app/(driver)/conduite/_lib/notify-pickup';

/**
 * POST /api/driver/rides/[rideId]/board — PWA-01 (§5.16).
 *
 * Transition `arrive_sur_place → patient_a_bord` (« patient à bord »). Même
 * pattern que /start et /arrive (auth, idempotency, compare-and-set DEC-168,
 * garde machine à états DEC-178). Rejouable hors-ligne (`board_ride`).
 *
 * SMS-01 (déplacé ici, §5.15) : la confirmation de prise en charge est envoyée
 * AU MOMENT « patient à bord » (sémantiquement exact) plutôt qu'au démarrage.
 * Best-effort APRÈS la transition committée + idempotent (un seul SMS / course).
 */

const payloadSchema = z.object({ idempotency_key: z.string().uuid() });
const rideIdSchema = z.string().uuid();

interface ResponseBody {
  success?: boolean;
  id?: string;
  error?: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest, props: { params: Promise<{ rideId: string }> }) {
  const params = await props.params;
  const rideIdParse = rideIdSchema.safeParse(params.rideId);
  if (!rideIdParse.success) {
    return NextResponse.json({ error: 'Identifiant course invalide.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const bodyParse = payloadSchema.safeParse(body);
  if (!bodyParse.success) {
    return NextResponse.json(
      { error: 'Payload invalide (idempotency_key UUID v4 requis).' },
      {
        status: 400,
      },
    );
  }

  const auth = await requireDriverFromRouteHandler();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await withIdempotency<ResponseBody>({
    key: bodyParse.data.idempotency_key,
    userId: auth.ctx.userId,
    mutationType: 'board_ride',
    resourceId: rideIdParse.data,
    supabase: auth.ctx.supabase,
    fn: async () => {
      const { data: current } = await auth.ctx.supabase
        .from('rides')
        .select('status, driver_id')
        .eq('id', rideIdParse.data)
        .single();
      const currentRow = (current as { status: string; driver_id: string | null } | null) ?? null;
      if (!currentRow) return { status: 404, body: { error: 'Course introuvable.' } };
      if (currentRow.driver_id !== auth.driverId) {
        return { status: 403, body: { error: 'Cette course ne vous est pas affectée.' } };
      }
      if (!canTransition(currentRow.status, 'patient_a_bord')) {
        return {
          status: 409,
          body: { error: 'Transition impossible (statut : ' + currentRow.status + ').' },
        };
      }

      const { data: updated, error } = await auth.ctx.supabase
        .from('rides')
        .update({ status: 'patient_a_bord', updated_by: auth.ctx.userId } as never)
        .eq('id', rideIdParse.data)
        .eq('status', 'arrive_sur_place')
        .select('id');
      if (error) return { status: 500, body: { error: 'Mise à jour impossible.' } };
      if (!updated || updated.length === 0) {
        return { status: 409, body: { error: 'Statut modifié entre-temps. Actualisez.' } };
      }

      // SMS-01 : prise en charge confirmée au patient (best-effort post-commit).
      await notifyPickupConfirmed(rideIdParse.data, auth.ctx.organizationId);

      revalidatePath('/conduite');
      return { status: 200, body: { success: true, id: rideIdParse.data } };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
