import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { driverPositionInputSchema, canTransition } from '@tap/shared';
import { requireDriverFromRouteHandler } from '@/lib/api/driver-auth';
import { recordDriverPosition } from '@/lib/geoloc/record-position';
import { withIdempotency } from '@/lib/api/idempotency';

/**
 * POST /api/driver/rides/[rideId]/end
 *
 * Clôture une course en cours (statut `en_cours` → `terminee`) avec tarif
 * + statut paiement. Endpoint consommé par le sync engine PWA offline
 * (Wave 4 future). Server Action équivalente `endRideAction` conservée
 * pour fallback online direct browser.
 *
 * Refinement Zod : `payment_status === 'encaisse'` ⇒ `payment_method`
 * requis (defense in depth vs check Postgres
 * `rides_payment_encaisse_complet`).
 *
 * Refs : DEC-045 LOCKED (PR #109), PLAN-1.md (PR #111), endRideAction
 * conduite/actions.ts (pattern reproduit avec adaptations Route Handler).
 */

const paymentMethodSchema = z.enum(['cash', 'cb', 'cheque', 'cgss_differe']);
const paymentStatusSchema = z.enum(['non_concerne', 'a_encaisser', 'encaisse']);

const endPayloadSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    tarif_amount_eur: z.number().nonnegative(),
    payment_status: paymentStatusSchema,
    payment_method: paymentMethodSchema.optional(),
  })
  .merge(driverPositionInputSchema)
  .refine((v) => v.payment_status !== 'encaisse' || !!v.payment_method, {
    message:
      'Une course encaissée doit indiquer le moyen de paiement (espèces, CB, chèque ou CGSS différé).',
    path: ['payment_method'],
  });

const rideIdSchema = z.string().uuid();

interface EndRideResponseBody {
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
  const bodyParse = endPayloadSchema.safeParse(body);
  if (!bodyParse.success) {
    return NextResponse.json(
      { error: bodyParse.error?.errors[0]?.message ?? 'Payload invalide.' },
      { status: 400 },
    );
  }

  const auth = await requireDriverFromRouteHandler();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await withIdempotency<EndRideResponseBody>({
    key: bodyParse.data.idempotency_key,
    userId: auth.ctx.userId,
    mutationType: 'end_ride',
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
      // DEC-178 + PWA-01 : clôture depuis patient_a_bord (séquence §5.16).
      if (!canTransition(currentRow.status, 'terminee')) {
        return {
          status: 409,
          body: {
            error:
              'Clôture impossible : le patient doit être à bord (statut : ' +
              currentRow.status +
              ').',
          },
        };
      }

      const nowIso = new Date().toISOString();
      const update: Record<string, unknown> = {
        status: 'terminee',
        ended_at: nowIso,
        tarif_amount_eur: bodyParse.data.tarif_amount_eur,
        tarif_source: 'manuel',
        payment_status: bodyParse.data.payment_status,
        updated_by: auth.ctx.userId,
      };
      if (bodyParse.data.payment_method !== undefined) {
        update.payment_method = bodyParse.data.payment_method;
      }
      if (bodyParse.data.payment_status === 'encaisse') {
        update.payment_received_at = nowIso;
      }

      const { data: updated, error } = await auth.ctx.supabase
        .from('rides')
        .update(update)
        .eq('id', rideIdParse.data)
        // PWA-01 : compare-and-set sur le statut source (anti-TOCTOU, DEC-168).
        .eq('status', 'patient_a_bord')
        .select('id');
      if (error) {
        return { status: 500, body: { error: 'Clôture course impossible.' } };
      }
      if (!updated || updated.length === 0) {
        return {
          status: 403,
          body: {
            error: 'Course non modifiée : vérifiez que vous êtes bien le chauffeur assigné.',
          },
        };
      }

      // Phase 10.0 DEC-096 : capture événementielle position.
      await recordDriverPosition({
        supabase: auth.ctx.supabase,
        organizationId: auth.ctx.organizationId,
        driverId: auth.driverId,
        rideId: rideIdParse.data,
        source: 'event',
        position: {
          lat: bodyParse.data.lat,
          lng: bodyParse.data.lng,
          accuracy: bodyParse.data.accuracy,
        },
      });

      revalidatePath('/conduite');
      return {
        status: 200,
        body: { success: true, id: rideIdParse.data },
      };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
