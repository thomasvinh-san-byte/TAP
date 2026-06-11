import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getActiveSmsConsentMap, renderTemplate, sendSms } from '@tap/sms';
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
 * Workflow (DEC-156 — N+1 éliminés, fiabilité) : identique au cron J-1
 * (consentements en 1 requête + envois parallélisés + insert groupé) PLUS
 * l'idempotency en 1 requête (au lieu de N) : un seul SELECT des ride_id déjà
 * notifiés sur la fenêtre, puis test en mémoire.
 */
export const runtime = 'nodejs';
// DEC-156 : garde-fou anti-timeout.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Taille de lot d'envoi : borne le parallélisme (rate limits provider SMS). */
const SEND_BATCH_SIZE = 10;

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

/**
 * Persiste les traces `sms_messages` en UN insert groupé (DEC-156, D-03).
 * Fallback ligne par ligne si l'insert groupé échoue → ne JAMAIS perdre la
 * trace d'un SMS déjà envoyé (garde-fou traçabilité RGPD).
 */
async function persistSmsRows(
  supabase: SupabaseClient<Database>,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('sms_messages').insert(rows as never);
  if (!error) return;
  console.error(
    '[cron j2h] insert groupé sms_messages échoué, fallback ligne par ligne:',
    error.message,
  );
  for (const row of rows) {
    const { error: rowErr } = await supabase.from('sms_messages').insert(row as never);
    if (rowErr) console.error('[cron j2h] insert sms_messages (fallback) échoué:', rowErr.message);
  }
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
        'driver:drivers(nom_affichage)',
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
    return NextResponse.json({ error: 'Template j2h_reminder introuvable' }, { status: 500 });
  }

  // DEC-156 : idempotency en 1 requête (au lieu de N) — ride_id déjà notifiés
  // `j2h_reminder` depuis idempotencyFloor. Sur erreur → 500 (ne pas risquer un
  // double envoi).
  const rideIds = rides.map((r) => r.id);
  const alreadySent = new Set<string>();
  if (rideIds.length > 0) {
    const dupRes = await supabase
      .from('sms_messages')
      .select('ride_id')
      .eq('template_key', 'j2h_reminder')
      .gte('created_at', idempotencyFloor)
      .in('ride_id', rideIds);
    if (dupRes.error) {
      return NextResponse.json({ error: dupRes.error.message }, { status: 500 });
    }
    for (const r of (dupRes.data ?? []) as Array<{ ride_id: string | null }>) {
      if (r.ride_id) alreadySent.add(r.ride_id);
    }
  }

  // DEC-156 : consentements en 1 requête. Sur erreur → 500 (fail-safe).
  const patientIds = Array.from(
    new Set(rides.map((r) => r.patient?.id).filter((x): x is string => Boolean(x))),
  );
  let consentMap: Map<string, boolean>;
  try {
    consentMap = await getActiveSmsConsentMap(supabase, patientIds);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Consentements illisibles' },
      { status: 500 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const statusCallback = appUrl ? `${appUrl}/api/sms/webhook/twilio` : undefined;

  let sent = 0;
  let skippedConsent = 0;
  let skippedIdempotency = 0;
  let failed = 0;

  const rowsToInsert: Record<string, unknown>[] = [];
  const toSend: { ride: CronRide; phone: string; body: string }[] = [];

  // Phase 1 — tri : idempotency, puis consentement (AVANT envoi), en mémoire.
  for (const ride of rides) {
    if (!ride.patient || !ride.patient.telephone) {
      failed++;
      continue;
    }
    if (alreadySent.has(ride.id)) {
      skippedIdempotency++;
      continue;
    }
    if (consentMap.get(ride.patient.id) !== true) {
      skippedConsent++;
      rowsToInsert.push({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j2h_reminder',
        to_phone: ride.patient.telephone,
        body_rendered: '',
        twilio_message_sid: null,
        delivery_status: 'skipped_consent_revoked',
        delivery_error: null,
        sent_at: null,
      });
      continue;
    }
    const body = renderTemplate(tpl.body, {
      patient_prenom: ride.patient.prenom ?? '',
      patient_nom: ride.patient.nom ?? '',
      date: formatDateFr(ride.scheduled_at),
      heure: formatHeureFr(ride.scheduled_at),
      chauffeur_prenom: ride.driver?.nom_affichage ?? '',
    });
    toSend.push({ ride, phone: ride.patient.telephone, body });
  }

  // Phase 2 — envois parallélisés par lots. Chaque envoi encapsulé (try/catch
  // interne) → un échec n'interrompt pas les autres et trace son erreur.
  for (let i = 0; i < toSend.length; i += SEND_BATCH_SIZE) {
    const batch = toSend.slice(i, i + SEND_BATCH_SIZE);
    const settled = await Promise.all(
      batch.map(async (item) => {
        try {
          const { sid } = await sendSms({ to: item.phone, body: item.body, statusCallback });
          return { ok: true as const, item, sid };
        } catch (err) {
          return {
            ok: false as const,
            item,
            reason: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    for (const r of settled) {
      const { ride, phone, body } = r.item;
      if (r.ok) {
        sent++;
        rowsToInsert.push({
          organization_id: ride.organization_id,
          patient_id: ride.patient!.id,
          ride_id: ride.id,
          template_key: 'j2h_reminder',
          to_phone: phone,
          body_rendered: body,
          twilio_message_sid: r.sid,
          delivery_status: 'queued',
          delivery_error: null,
          sent_at: new Date().toISOString(),
        });
      } else {
        failed++;
        rowsToInsert.push({
          organization_id: ride.organization_id,
          patient_id: ride.patient!.id,
          ride_id: ride.id,
          template_key: 'j2h_reminder',
          to_phone: phone,
          body_rendered: body,
          twilio_message_sid: null,
          delivery_status: 'failed',
          delivery_error: r.reason,
          sent_at: null,
        });
      }
    }
  }

  // Phase 3 — traçabilité groupée.
  await persistSmsRows(supabase, rowsToInsert);

  return NextResponse.json({
    processed: rides.length,
    sent,
    skipped_consent: skippedConsent,
    skipped_idempotency: skippedIdempotency,
    failed,
  });
}
