import 'server-only';

/**
 * Confirmation SMS des patients d'un planning VALIDÉ (Module 5.12 lot D). Appelé
 * en BEST-EFFORT par `validatePlanningAction` APRÈS la validation committée : un
 * échec d'envoi NE rollback JAMAIS la validation (déjà persistée).
 *
 * Réutilise le socle SMS (DEC-156) — AUCUNE règle réécrite : consentements en
 * une requête (`getActiveSmsConsentMap`), règle RGPD unique (DEC-008), trace
 * `sms_messages`, envois par lots. Client service-role (comme les crons) car
 * `sms_messages` n'a pas de policy INSERT `authenticated`. Requêtes filtrées
 * `organization_id` (defense in depth). Template `j1_reminder` (rappel/
 * confirmation course du lendemain) — pas d'ETA inventé sans géoloc HDS.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getActiveSmsConsentMap, renderTemplate, sendSms } from '@tap/sms';
import type { Database } from '@tap/database';

const TEMPLATE_KEY = 'j1_reminder';
const SEND_BATCH_SIZE = 10;

function adminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface ConfirmRide {
  id: string;
  scheduled_at: string;
  organization_id: string;
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

async function persistSmsRows(
  supabase: SupabaseClient<Database>,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from('sms_messages').insert(rows as never);
  if (!error) return;
  console.error(
    '[planning validé sms] insert groupé échoué, fallback ligne par ligne:',
    error.message,
  );
  for (const row of rows) {
    const { error: rowErr } = await supabase.from('sms_messages').insert(row as never);
    if (rowErr) console.error('[planning validé sms] insert (fallback) échoué:', rowErr.message);
  }
}

/**
 * Confirme aux patients des `rideIds` que leur course du planning validé est
 * confirmée. Best-effort total : toute erreur est loggée, jamais propagée.
 * Retourne le nombre d'envois mis en file (traçabilité, non bloquant).
 */
export async function notifyValidatedPlanningPatients(
  rideIds: string[],
  organizationId: string,
): Promise<number> {
  if (rideIds.length === 0) return 0;
  try {
    const supabase = adminSupabase();

    const ridesRes = await supabase
      .from('rides')
      .select(
        'id, scheduled_at, organization_id, ' +
          'patient:patients(id, prenom, nom, telephone), driver:drivers(nom_affichage)',
      )
      .in('id', rideIds)
      .eq('organization_id', organizationId);
    if (ridesRes.error) {
      console.error('[planning validé sms] lecture courses échouée:', ridesRes.error.message);
      return 0;
    }
    const rides = (ridesRes.data as unknown as ConfirmRide[] | null) ?? [];
    if (rides.length === 0) return 0;

    const tplRes = await supabase
      .from('sms_templates')
      .select('body')
      .eq('key', TEMPLATE_KEY)
      .maybeSingle();
    const tpl = tplRes.data as { body: string } | null;
    if (tplRes.error || !tpl) {
      console.error('[planning validé sms] template j1_reminder introuvable');
      return 0;
    }

    const patientIds = Array.from(
      new Set(rides.map((r) => r.patient?.id).filter((x): x is string => Boolean(x))),
    );
    let consentMap: Map<string, boolean>;
    try {
      consentMap = await getActiveSmsConsentMap(supabase, patientIds);
    } catch (err) {
      console.error('[planning validé sms] consentements illisibles:', err);
      return 0;
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const statusCallback = appUrl ? `${appUrl}/api/sms/webhook/twilio` : undefined;

    const rowsToInsert: Record<string, unknown>[] = [];
    const toSend: { ride: ConfirmRide; phone: string; body: string }[] = [];

    for (const ride of rides) {
      if (!ride.patient || !ride.patient.telephone) continue;
      if (consentMap.get(ride.patient.id) !== true) {
        rowsToInsert.push({
          organization_id: ride.organization_id,
          patient_id: ride.patient.id,
          ride_id: ride.id,
          template_key: TEMPLATE_KEY,
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

    let queued = 0;
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
        if (r.ok) queued += 1;
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
    return queued;
  } catch (err) {
    console.error('[planning validé sms] échec global (best-effort, validation conservée):', err);
    return 0;
  }
}
