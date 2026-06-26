import 'server-only';

/**
 * Notification SMS des patients dont la course est annulée pour alerte météo
 * (DEC-170, CdG l.380-385). Appelé en BEST-EFFORT par
 * `cancelRidesBatchWeatherAction` APRÈS l'annulation committée : un échec
 * d'envoi NE rollback JAMAIS l'annulation (action métier déjà persistée).
 *
 * Réutilise le socle SMS 09.03 (DEC-156) — AUCUNE règle réécrite :
 *   - `getActiveSmsConsentMap` : consentements en 1 requête (anti-N+1).
 *   - `isConsentValid` (via la Map) : règle RGPD unique (DEC-008).
 *   - `sendSms` + trace `sms_messages` (queued / skipped_consent_revoked / failed).
 *   - Envois parallélisés par lots (pattern cron).
 *
 * Client service-role (comme les crons) : `sms_messages` n'a pas de policy
 * INSERT pour `authenticated` (seulement SELECT) → l'insert RLS échouerait.
 * Toutes les requêtes sont explicitement filtrées `organization_id` (defense
 * in depth). Template `annulation_meteo` (pas d'horaire de report inventé : on
 * annonce un recontact ultérieur, reprise J+1/J+2 hors scope V1).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getActiveSmsConsentMap, renderTemplate, sendSms } from '@tap/sms';
import type { Database } from '@tap/database';

const TEMPLATE_KEY = 'annulation_meteo';
const SEND_BATCH_SIZE = 10;

function adminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface MeteoRide {
  id: string;
  scheduled_at: string;
  organization_id: string;
  patient: {
    id: string;
    prenom: string | null;
    nom: string | null;
    telephone: string | null;
  } | null;
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

/** Insert groupé `sms_messages` + fallback ligne par ligne (pattern DEC-156). */
async function persistSmsRows(
  supabase: SupabaseClient<Database>,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('sms_messages').insert(rows as never);
  if (!error) return;
  console.error('[meteo sms] insert groupé échoué, fallback ligne par ligne:', error.message);
  for (const row of rows) {
    const { error: rowErr } = await supabase.from('sms_messages').insert(row as never);
    if (rowErr) console.error('[meteo sms] insert (fallback) échoué:', rowErr.message);
  }
}

function buildSkippedRow(ride: MeteoRide): Record<string, unknown> {
  return {
    organization_id: ride.organization_id,
    patient_id: ride.patient!.id,
    ride_id: ride.id,
    template_key: TEMPLATE_KEY,
    to_phone: ride.patient!.telephone,
    body_rendered: '',
    twilio_message_sid: null,
    delivery_status: 'skipped_consent_revoked',
    delivery_error: null,
    sent_at: null,
  };
}

/**
 * Prévient les patients des `rideIds` annulés pour météo. Best-effort total :
 * toute erreur est loggée, jamais propagée.
 */
export async function notifyWeatherCancellation(
  rideIds: string[],
  organizationId: string,
): Promise<void> {
  if (rideIds.length === 0) return;
  try {
    const supabase = adminSupabase();

    const ridesRes = await supabase
      .from('rides')
      .select('id, scheduled_at, organization_id, patient:patients(id, prenom, nom, telephone)')
      .in('id', rideIds)
      .eq('organization_id', organizationId);
    if (ridesRes.error) {
      console.error('[meteo sms] lecture courses échouée:', ridesRes.error.message);
      return;
    }
    const rides = (ridesRes.data as unknown as MeteoRide[] | null) ?? [];
    if (rides.length === 0) return;

    const tplRes = await supabase
      .from('sms_templates')
      .select('body')
      .eq('key', TEMPLATE_KEY)
      .maybeSingle();
    const tpl = tplRes.data as { body: string } | null;
    if (tplRes.error || !tpl) {
      console.error('[meteo sms] template annulation_meteo introuvable');
      return;
    }

    const patientIds = Array.from(
      new Set(rides.map((r) => r.patient?.id).filter((x): x is string => Boolean(x))),
    );
    let consentMap: Map<string, boolean>;
    try {
      consentMap = await getActiveSmsConsentMap(supabase, patientIds);
    } catch (err) {
      console.error('[meteo sms] consentements illisibles:', err);
      return;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const statusCallback = appUrl ? `${appUrl}/api/sms/webhook/twilio` : undefined;

    const rowsToInsert: Record<string, unknown>[] = [];
    const toSend: { ride: MeteoRide; phone: string; body: string }[] = [];

    // Tri : consentement vérifié AVANT envoi (RGPD, DEC-008).
    for (const ride of rides) {
      if (!ride.patient || !ride.patient.telephone) continue;
      if (consentMap.get(ride.patient.id) !== true) {
        rowsToInsert.push(buildSkippedRow(ride));
        continue;
      }
      const body = renderTemplate(tpl.body, {
        patient_prenom: ride.patient.prenom ?? '',
        patient_nom: ride.patient.nom ?? '',
        date: formatDateFr(ride.scheduled_at),
      });
      toSend.push({ ride, phone: ride.patient.telephone, body });
    }

    // Envois parallélisés par lots (un échec n'interrompt pas les autres).
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
        rowsToInsert.push({
          organization_id: ride.organization_id,
          patient_id: ride.patient!.id,
          ride_id: ride.id,
          template_key: TEMPLATE_KEY,
          to_phone: phone,
          body_rendered: body,
          twilio_message_sid: r.ok ? r.sid : null,
          delivery_status: r.ok ? 'queued' : 'failed',
          delivery_error: r.ok ? null : r.reason,
          sent_at: r.ok ? new Date().toISOString() : null,
        });
      }
    }

    await persistSmsRows(supabase, rowsToInsert);
  } catch (err) {
    console.error('[meteo sms] échec global (best-effort, annulation conservée):', err);
  }
}
