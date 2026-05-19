import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasActiveSmsConsent, renderTemplate, sendSms } from '@tap/sms';
import type { Database } from '@tap/database';

/**
 * Cron J-2h — envoi rappel 2h avant la course.
 *
 * Déclenchement : pg_cron `sms-reminder-j2h` (toutes les heures) via
 * pg_net.http_post Bearer Vault secret `cron_app_token`.
 *
 * Fenêtre temporelle : rides dont `scheduled_at` est entre `now + 1h45m`
 * et `now + 2h15m`. Cron horaire → la même fenêtre peut être balayée
 * 2 fois (rotation de 30 min). Idempotency garantie via check
 * `sms_messages` : aucun envoi `j2h_reminder` pour ce ride dans les
 * 4h précédentes.
 *
 * Workflow identique au cron J-1 + idempotency check par ride.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function adminSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface CronRide {
  id: string;
  scheduled_at: string;
  organization_id: string;
  patient_id: string | null;
  patient: {
    id: string;
    prenom: string | null;
    nom: string | null;
    telephone: string | null;
  } | null;
  driver: { prenom: string | null; nom: string | null } | null;
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Indian/Reunion',
  });
}

function formatHeureFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Reunion',
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get('authorization');
  const expected = process.env.CRON_APP_TOKEN;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminSupabase();

  const now = Date.now();
  const windowStart = new Date(now + 1.75 * 3_600_000).toISOString();
  const windowEnd = new Date(now + 2.25 * 3_600_000).toISOString();
  const idempotencyFloor = new Date(now - 4 * 3_600_000).toISOString();

  const ridesRes = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, organization_id, patient_id, ' +
        'patient:patients(id, prenom, nom, telephone), ' +
        'driver:drivers(prenom, nom)',
    )
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)
    .in('status', ['validee', 'assignee']);

  if (ridesRes.error) {
    return NextResponse.json({ error: ridesRes.error.message }, { status: 500 });
  }
  const rides = (ridesRes.data as unknown as CronRide[] | null) ?? [];

  const tplRes = await supabase
    .from('sms_templates')
    .select('body')
    .eq('key', 'j2h_reminder')
    .maybeSingle();
  const tpl = tplRes.data as { body: string } | null;
  if (tplRes.error || !tpl) {
    return NextResponse.json(
      { error: 'Template j2h_reminder introuvable' },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const statusCallback = appUrl ? `${appUrl}/api/sms/webhook/twilio` : undefined;

  let sent = 0;
  let skippedConsent = 0;
  let skippedIdempotency = 0;
  let failed = 0;

  for (const ride of rides) {
    if (!ride.patient || !ride.patient.telephone) {
      failed++;
      continue;
    }

    const dup = await supabase
      .from('sms_messages')
      .select('id')
      .eq('ride_id', ride.id)
      .eq('template_key', 'j2h_reminder')
      .gte('created_at', idempotencyFloor)
      .limit(1)
      .maybeSingle();
    if (dup.data) {
      skippedIdempotency++;
      continue;
    }

    const hasConsent = await hasActiveSmsConsent(supabase, ride.patient.id);
    if (!hasConsent) {
      skippedConsent++;
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j2h_reminder',
        to_phone: ride.patient.telephone,
        body_rendered: '',
        delivery_status: 'skipped_consent_revoked',
      } as never);
      continue;
    }

    const body = renderTemplate(tpl.body, {
      patient_prenom: ride.patient.prenom ?? '',
      patient_nom: ride.patient.nom ?? '',
      date: formatDateFr(ride.scheduled_at),
      heure: formatHeureFr(ride.scheduled_at),
      chauffeur_prenom: ride.driver?.prenom ?? '',
    });

    try {
      const { sid } = await sendSms({
        to: ride.patient.telephone,
        body,
        statusCallback,
      });
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j2h_reminder',
        to_phone: ride.patient.telephone,
        body_rendered: body,
        twilio_message_sid: sid,
        delivery_status: 'queued',
        sent_at: new Date().toISOString(),
      } as never);
      sent++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j2h_reminder',
        to_phone: ride.patient.telephone,
        body_rendered: body,
        delivery_status: 'failed',
        delivery_error: reason,
      } as never);
      failed++;
    }
  }

  return NextResponse.json({
    processed: rides.length,
    sent,
    skipped_consent: skippedConsent,
    skipped_idempotency: skippedIdempotency,
    failed,
  });
}
