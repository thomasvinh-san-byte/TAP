import 'server-only';

/**
 * Notification SMS « prise en charge confirmée » (SMS-01, §5.15). Appelée en
 * BEST-EFFORT au moment « patient à bord » (PWA-01 : transition arrive_sur_place
 * → patient_a_bord, route API `board`), APRÈS la transition committée — moment
 * sémantiquement exact de la prise en charge. Un échec d'envoi NE fait JAMAIS
 * échouer la transition (le métier prime — pattern `notify-reaffectation`).
 *
 * Réutilise le socle SMS (DEC-156, DEC-008) sans rien réécrire :
 *   - `getActiveSmsConsentMap` : consentement vrai ET horodaté (RGPD, ABSOLU).
 *   - `renderTemplate` (variables verrouillées DEC-051) + `sendSms`.
 *   - trace `sms_messages` (queued / skipped_consent_revoked / failed).
 *
 * Idempotence : un seul SMS de prise en charge par course. On saute si une
 * trace `pickup_confirmed` existe déjà pour ce ride (redémarrage technique,
 * double chemin) — pas de spam.
 *
 * Client service-role (comme les crons) : `sms_messages` n'a pas de policy
 * INSERT pour `authenticated`. Toutes les requêtes filtrent `organization_id`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getActiveSmsConsentMap, renderTemplate, sendSms } from '@tap/sms';
import type { Database } from '@tap/database';

const TEMPLATE_KEY = 'pickup_confirmed';

function adminSupabase(): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

interface PickupRide {
  id: string;
  organization_id: string;
  patient: {
    id: string;
    prenom: string | null;
    nom: string | null;
    telephone: string | null;
  } | null;
  driver: { nom_affichage: string | null } | null;
}

/** Envoi best-effort de la confirmation de prise en charge pour une course. */
export async function notifyPickupConfirmed(rideId: string, organizationId: string): Promise<void> {
  try {
    const supabase = adminSupabase();

    // Idempotence : déjà notifié pour cette course → on ne renvoie pas.
    const existing = await supabase
      .from('sms_messages')
      .select('id')
      .eq('ride_id', rideId)
      .eq('template_key', TEMPLATE_KEY)
      .limit(1);
    if ((existing.data as unknown[] | null)?.length) return;

    const rideRes = await supabase
      .from('rides')
      .select(
        'id, organization_id, ' +
          'patient:patients(id, prenom, nom, telephone), driver:drivers(nom_affichage)',
      )
      .eq('id', rideId)
      .eq('organization_id', organizationId)
      .maybeSingle();
    const ride = rideRes.data as unknown as PickupRide | null;
    if (rideRes.error || !ride || !ride.patient || !ride.patient.telephone) return;

    const tplRes = await supabase
      .from('sms_templates')
      .select('body')
      .eq('key', TEMPLATE_KEY)
      .maybeSingle();
    const tpl = tplRes.data as { body: string } | null;
    if (tplRes.error || !tpl) return;

    let consentMap: Map<string, boolean>;
    try {
      consentMap = await getActiveSmsConsentMap(supabase, [ride.patient.id]);
    } catch {
      return; // consentement illisible → fail-safe, aucun envoi
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const statusCallback = appUrl ? `${appUrl}/api/sms/webhook/twilio` : undefined;

    // Consentement vérifié AVANT envoi (DEC-008). Sans consentement : trace seule.
    if (consentMap.get(ride.patient.id) !== true) {
      await supabase.from('sms_messages').insert({
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
      } as never);
      return;
    }

    const body = renderTemplate(tpl.body, {
      patient_prenom: ride.patient.prenom ?? '',
      patient_nom: ride.patient.nom ?? '',
      chauffeur_prenom: ride.driver?.nom_affichage ?? '',
    });

    let sid: string | null = null;
    let error: string | null = null;
    try {
      const res = await sendSms({ to: ride.patient.telephone, body, statusCallback });
      sid = res.sid;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    await supabase.from('sms_messages').insert({
      organization_id: ride.organization_id,
      patient_id: ride.patient.id,
      ride_id: ride.id,
      template_key: TEMPLATE_KEY,
      to_phone: ride.patient.telephone,
      body_rendered: body,
      twilio_message_sid: sid,
      delivery_status: sid ? 'queued' : 'failed',
      delivery_error: error,
      sent_at: sid ? new Date().toISOString() : null,
    } as never);
  } catch (err) {
    // Best-effort total : jamais propagé (le démarrage reste committé).
    console.error('[pickup sms] échec (best-effort, démarrage conservé):', err);
  }
}
