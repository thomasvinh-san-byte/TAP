import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { hasActiveSmsConsent, renderTemplate, sendSms } from '@tap/sms';
import type { Database } from '@tap/database';

/**
 * Cron J-1 — envoi rappel SMS aux patients ayant une course demain.
 *
 * Déclenchement : pg_cron `sms-reminder-j1` (14h UTC = 18h Réunion) via
 * pg_net.http_post Bearer Vault secret `cron_app_token` (migration Wave 1
 * 20260519000007). Sans le secret Vault, l'appel arrive avec un Bearer
 * vide → 401 ici (comportement attendu).
 *
 * Workflow :
 *   1. Auth Bearer CRON_APP_TOKEN (miroir Vault secret)
 *   2. Query rides J+1 status non_assignee/assignee + JOIN patient/driver
 *   3. Fetch template `j1_reminder`
 *   4. Pour chaque ride : DEC-008 consent check → Twilio send → log
 *   5. Réponse JSON { processed, sent, skipped_consent, failed }
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
  driver: { nom_affichage: string | null } | null;
}

function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Indian/Reunion',
  });
}

function formatHeureFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
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

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  const ridesRes = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, organization_id, patient_id, ' +
        'patient:patients(id, prenom, nom, telephone), ' +
        'driver:drivers(nom_affichage)',
    )
    .gte('scheduled_at', `${dateStr}T00:00:00`)
    .lte('scheduled_at', `${dateStr}T23:59:59`)
    .in('status', ['validee', 'assignee']);

  if (ridesRes.error) {
    return NextResponse.json({ error: ridesRes.error.message }, { status: 500 });
  }
  const rides = (ridesRes.data as unknown as CronRide[] | null) ?? [];

  const tplRes = await supabase
    .from('sms_templates')
    .select('body')
    .eq('key', 'j1_reminder')
    .maybeSingle();
  const tpl = tplRes.data as { body: string } | null;
  if (tplRes.error || !tpl) {
    return NextResponse.json({ error: 'Template j1_reminder introuvable' }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const statusCallback = appUrl ? `${appUrl}/api/sms/webhook/twilio` : undefined;

  let sent = 0;
  let skippedConsent = 0;
  let failed = 0;

  for (const ride of rides) {
    if (!ride.patient || !ride.patient.telephone) {
      failed++;
      continue;
    }

    const hasConsent = await hasActiveSmsConsent(supabase, ride.patient.id);
    if (!hasConsent) {
      skippedConsent++;
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j1_reminder',
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
      chauffeur_prenom: ride.driver?.nom_affichage ?? '',
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
        template_key: 'j1_reminder',
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
        template_key: 'j1_reminder',
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
    failed,
  });
}
