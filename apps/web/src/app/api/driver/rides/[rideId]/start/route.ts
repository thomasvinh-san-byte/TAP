import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDriverFromRouteHandler } from '@/lib/api/driver-auth';
import { withIdempotency } from '@/lib/api/idempotency';

/**
 * POST /api/driver/rides/[rideId]/start
 *
 * Démarre une course assignée au chauffeur authentifié (statut
 * `assignee` → `en_cours`). Endpoint consommé par le sync engine PWA
 * offline (Wave 4 future). Server Action équivalente `startRideAction`
 * conservée pour fallback online direct browser.
 *
 * Pattern reproduit `startRideAction` (conduite/actions.ts) avec
 * adaptations Route Handler :
 *   - getAuthContext() via cookies() (compatible Route Handler)
 *   - Row count check DEC-041 conservé (RLS rejet silencieux détecté)
 *   - Idempotency wrapper UUID v4 dédupée 24h
 *
 * Refs : DEC-045 LOCKED Route Handlers (PR #109), PLAN-1.md (PR #111).
 */

const startPayloadSchema = z.object({
  idempotency_key: z.string().uuid(),
});

const rideIdSchema = z.string().uuid();

interface StartRideResponseBody {
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
  const bodyParse = startPayloadSchema.safeParse(body);
  if (!bodyParse.success) {
    return NextResponse.json(
      { error: 'Payload invalide (idempotency_key UUID v4 requis).' },
      { status: 400 },
    );
  }

  const auth = await requireDriverFromRouteHandler();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await withIdempotency<StartRideResponseBody>({
    key: bodyParse.data.idempotency_key,
    userId: auth.ctx.userId,
    mutationType: 'start_ride',
    resourceId: rideIdParse.data,
    supabase: auth.ctx.supabase,
    fn: async () => {
      const { data: current } = await auth.ctx.supabase
        .from('rides')
        .select('status, driver_id')
        .eq('id', rideIdParse.data)
        .single();
      const currentRow = (current as { status: string; driver_id: string | null } | null) ?? null;
      if (!currentRow) {
        return { status: 404, body: { error: 'Course introuvable.' } };
      }
      if (currentRow.driver_id !== auth.driverId) {
        return {
          status: 403,
          body: { error: 'Cette course ne vous est pas affectée.' },
        };
      }
      if (currentRow.status !== 'assignee') {
        return {
          status: 409,
          body: {
            error:
              "Démarrage impossible : la course n'est pas en attente (statut : " +
              currentRow.status +
              ').',
          },
        };
      }

      const update = {
        status: 'en_cours',
        started_at: new Date().toISOString(),
        updated_by: auth.ctx.userId,
      };
      const { data: updated, error } = await auth.ctx.supabase
        .from('rides')
        .update(update as never)
        .eq('id', rideIdParse.data)
        .select('id');
      if (error) {
        return { status: 500, body: { error: 'Démarrage course impossible.' } };
      }
      if (!updated || updated.length === 0) {
        return {
          status: 403,
          body: {
            error: 'Course non modifiée — vérifiez que vous êtes bien le chauffeur assigné.',
          },
        };
      }

      revalidatePath('/conduite');
      return {
        status: 200,
        body: { success: true, id: rideIdParse.data },
      };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
