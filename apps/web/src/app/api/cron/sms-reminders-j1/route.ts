import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getActiveSmsConsentMap, renderTemplate, sendSms } from '@tap/sms';
import type { Database } from '@tap/database';

/**
 * Cron J-1 — envoi rappel SMS aux patients ayant une course demain.
 *
 * Déclenchement : pg_cron `sms-reminder-j1` (14h UTC = 18h Réunion) via
 * pg_net.http_post Bearer Vault secret `cron_app_token` (migration Wave 1
 * 20260519000007). Sans le secret Vault, l'appel arrive avec un Bearer
 * vide → 401 ici (comportement attendu).
 *
 * Workflow (DEC-156 — N+1 éliminé, fiabilité) :
 *   1. Auth Bearer CRON_APP_TOKEN (miroir Vault secret)
 *   2. Query rides J+1 status validee/assignee + JOIN patient/driver
 *   3. Fetch template `j1_reminder`
 *   4. Consentements en 1 requête (Map id→valide), PAS N (DEC-008 préservé)
 *   5. Envois parallélisés par lots (allSettled) — un échec n'arrête pas les autres
 *   6. Traçabilité `sms_messages` en insert GROUPÉ (fallback ligne par ligne)
 *   7. Réponse JSON { processed, sent, skipped_consent, failed }
 */
export const runtime = 'nodejs';
// DEC-156 : garde-fou anti-timeout (sans ça, un cron sur gros volume peut être
// tué avant d'avoir traité tous les rappels → patients non prévenus).
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
    '[cron j1] insert groupé sms_messages échoué, fallback ligne par ligne:',
    error.message,
  );
  for (const row of rows) {
    const { error: rowErr } = await supabase.from('sms_messages').insert(row as never);
    if (rowErr) console.error('[cron j1] insert sms_messages (fallback) échoué:', rowErr.message);
  }
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

  // DEC-156 : consentements de tous les patients en 1 requête (au lieu de N).
  // Sur erreur de lecture → 500 (fail-safe : aucun envoi dans le doute, pas de
  // faux statut « consentement révoqué » écrit en masse).
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
  let failed = 0;

  const rowsToInsert: Record<string, unknown>[] = [];
  const toSend: { ride: CronRide; phone: string; body: string }[] = [];

  // Phase 1 — tri (consentement vérifié AVANT envoi, en mémoire).
  for (const ride of rides) {
    if (!ride.patient || !ride.patient.telephone) {
      failed++;
      continue;
    }
    if (consentMap.get(ride.patient.id) !== true) {
      skippedConsent++;
      rowsToInsert.push({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j1_reminder',
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

  // Phase 2 — envois parallélisés par lots (DEC-156, D-02). Chaque envoi est
  // encapsulé (try/catch interne) → un échec n'interrompt pas les autres et
  // trace son erreur (équivalent allSettled, contexte porté dans le résultat).
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
          template_key: 'j1_reminder',
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
          template_key: 'j1_reminder',
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

  // Phase 3 — traçabilité groupée (DEC-156, D-03).
  await persistSmsRows(supabase, rowsToInsert);

  return NextResponse.json({
    processed: rides.length,
    sent,
    skipped_consent: skippedConsent,
    failed,
  });
}
