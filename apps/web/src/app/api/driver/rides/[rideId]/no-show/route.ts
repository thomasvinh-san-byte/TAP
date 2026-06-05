import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { driverPositionInputSchema } from '@tap/shared';
import { requireDriverFromRouteHandler } from '@/lib/api/driver-auth';
import { withIdempotency } from '@/lib/api/idempotency';
import { recordDriverPosition } from '@/lib/geoloc/record-position';

/**
 * POST /api/driver/rides/[rideId]/no-show
 *
 * Déclare le patient absent : UPDATE rides (no_show_at + no_show_motif)
 * + INSERT ride_events (patient_no_show) → alerte cockpit régulatrice
 * en temps réel.
 *
 * Pattern STRICT DEC-045 / DEC-053 (cohérent /start et /end Phase 04.9) :
 *   - auth cookies via requireDriverFromRouteHandler
 *   - Zod validation (idempotency_key UUID + motif optional 200 chars)
 *   - withIdempotency wrapper (dédupe 24h via idempotency_keys)
 *   - status guards explicites (assignee OU en_route_pickup uniquement)
 *   - driver_id ownership check
 *   - DEC-041 row count check (UPDATE .select('id'))
 *   - INSERT ride_events alerte cockpit
 *   - response idempotent (stored response_json)
 *
 * Refs : DEC-045 LOCKED (PR #109), DEC-053 LOCKED, PLAN-6.md.
 */

const payloadSchema = z
  .object({
    idempotency_key: z.string().uuid(),
    motif: z.string().max(200).optional(),
  })
  .merge(driverPositionInputSchema);

const rideIdSchema = z.string().uuid();

interface NoShowResponseBody {
  success?: boolean;
  ride_id?: string;
  no_show_at?: string;
  error?: string;
  [key: string]: unknown;
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ rideId: string }> },
): Promise<NextResponse> {
  const params = await props.params;
  const rideIdParse = rideIdSchema.safeParse(params.rideId);
  if (!rideIdParse.success) {
    return NextResponse.json({ error: 'Identifiant course invalide.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const bodyParse = payloadSchema.safeParse(body);
  if (!bodyParse.success) {
    return NextResponse.json(
      { error: 'Payload invalide (idempotency_key UUID requis, motif max 200 chars).' },
      { status: 400 },
    );
  }

  const auth = await requireDriverFromRouteHandler();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await withIdempotency<NoShowResponseBody>({
    key: bodyParse.data.idempotency_key,
    userId: auth.ctx.userId,
    mutationType: 'no_show_ride',
    resourceId: rideIdParse.data,
    supabase: auth.ctx.supabase,
    fn: async () => {
      const { data: current } = await auth.ctx.supabase
        .from('rides')
        .select('status, driver_id, organization_id')
        .eq('id', rideIdParse.data)
        .single();
      const currentRow =
        (current as {
          status: string;
          driver_id: string | null;
          organization_id: string;
        } | null) ?? null;
      if (!currentRow) {
        return { status: 404, body: { error: 'Course introuvable.' } };
      }
      if (currentRow.driver_id !== auth.driverId) {
        return {
          status: 403,
          body: { error: 'Cette course ne vous est pas affectée.' },
        };
      }
      // Patient absent ne peut être déclaré que sur une course assignée OU en route.
      // (Si la course est déjà 'en_cours' = chauffeur a démarré transport,
      // c'est un autre workflow Phase 06+ « patient absent en route ».)
      if (currentRow.status !== 'assignee') {
        return {
          status: 409,
          body: {
            error:
              "Déclaration impossible : la course n'est plus en attente (statut : " +
              currentRow.status +
              ').',
          },
        };
      }

      const nowIso = new Date().toISOString();
      const update = {
        no_show_at: nowIso,
        no_show_motif: bodyParse.data.motif ?? null,
        updated_by: auth.ctx.userId,
      };
      const { data: updated, error: updateErr } = await auth.ctx.supabase
        .from('rides')
        .update(update as never)
        .eq('id', rideIdParse.data)
        .select('id');
      if (updateErr) {
        return { status: 500, body: { error: 'Déclaration impossible.' } };
      }
      if (!updated || updated.length === 0) {
        return {
          status: 403,
          body: {
            error: 'Course non modifiée — vérifiez que vous êtes le chauffeur assigné.',
          },
        };
      }

      // INSERT ride_events pour cockpit Realtime (alerte instantanée régulatrice).
      const { error: eventErr } = await auth.ctx.supabase.from('ride_events' as never).insert({
        organization_id: currentRow.organization_id,
        ride_id: rideIdParse.data,
        event_type: 'patient_no_show',
        payload: { motif: bodyParse.data.motif ?? null },
        created_by: auth.ctx.userId,
      } as never);
      if (eventErr) {
        return {
          status: 500,
          body: { error: 'Mise à jour OK mais alerte cockpit non créée.' },
        };
      }

      // Audit trail.
      await auth.ctx.supabase.from('audit_logs').insert({
        organization_id: currentRow.organization_id,
        actor_id: auth.ctx.userId,
        actor_role: 'chauffeur',
        action: 'ride.patient_no_show',
        entity_type: 'ride',
        entity_id: rideIdParse.data,
        metadata: {
          motif: bodyParse.data.motif ?? null,
        },
      } as never);

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
      revalidatePath('/cockpit');
      return {
        status: 200,
        body: { success: true, ride_id: rideIdParse.data, no_show_at: nowIso },
      };
    },
  });

  return NextResponse.json(result.body, { status: result.status });
}
