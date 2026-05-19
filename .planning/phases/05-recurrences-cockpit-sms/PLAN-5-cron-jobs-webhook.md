# Plan-5 — Cron jobs SMS J-1 + J-2h + webhook Twilio

**Phase**: 05
**Wave**: 5/7
**Dépendances**: Wave 1 (pg_net + Vault + cron.schedule) + Wave 4 (packages/sms)
**Estimation**: 1.5h (vélocité projetée 20-30 min réel)
**Refs**: DEC-050 RÉVISÉ pg_cron + pg_net → Route Handler, DEC-052 webhook Twilio HMAC, DEC-008 consent runtime, Source 5 pg_cron+pg_net combo

---

## Goal

Automatisation envois SMS rappel J-1 18h + J-2h via pg_cron (Wave 1) qui déclenchent Route Handlers Next.js auth Bearer. Webhook Twilio delivery status update `sms_messages` avec HMAC `X-Twilio-Signature` validé (DEC-052).

---

## Fichiers à créer (3)

```
apps/web/src/app/api/
  cron/sms-reminders-j1/route.ts        # POST Bearer auth + J-1 envoi
  cron/sms-reminders-j2h/route.ts       # POST Bearer auth + J-2h envoi
  sms/webhook/twilio/route.ts           # POST Twilio status callback HMAC validé
```

## Fichiers à modifier

- `apps/web/.env.example` — ajouter `CRON_APP_TOKEN`, `TWILIO_AUTH_TOKEN`
- Documentation post-deploy (SUMMARY Wave 7) : étapes manuelles Vault secret + Vercel env vars

---

## `/api/cron/sms-reminders-j1/route.ts`

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderTemplate, sendSms, hasActiveSmsConsent } from '@tap/sms';

// Service role pour query cross-organization (cron = system level)
function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  // 1. Auth Bearer CRON_APP_TOKEN (cohérent Vault secret Wave 1)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_APP_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = adminSupabase();

  // 2. Query rides demain (J+1) avec patient + chauffeur + template
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = `${tomorrow.toISOString().slice(0, 10)}T00:00:00`;
  const tomorrowEnd = `${tomorrow.toISOString().slice(0, 10)}T23:59:59`;

  const { data: rides, error } = await supabase
    .from('rides')
    .select(`
      id, scheduled_at, organization_id, patient_id,
      patient:patients(id, prenom, nom, telephone),
      driver:drivers(prenom, nom)
    `)
    .gte('scheduled_at', tomorrowStart)
    .lte('scheduled_at', tomorrowEnd)
    .in('status', ['non_assignee', 'assignee']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 3. Fetch template j1_reminder (cohérent sms_templates table Wave 1)
  const { data: tmplRow } = await supabase
    .from('sms_templates')
    .select('body')
    .eq('key', 'j1_reminder')
    .single();
  if (!tmplRow) return NextResponse.json({ error: 'Template j1_reminder introuvable' }, { status: 500 });

  let sentCount = 0, skippedConsent = 0, failedCount = 0;

  for (const ride of rides ?? []) {
    // 4. DEC-008 check consent runtime PAR PATIENT
    const consent = await hasActiveSmsConsent(supabase, ride.patient.id);
    if (!consent) {
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j1_reminder',
        to_phone: ride.patient.telephone ?? '',
        body_rendered: '',
        delivery_status: 'skipped_consent_revoked',
      });
      skippedConsent++;
      continue;
    }

    if (!ride.patient.telephone) {
      failedCount++;
      continue;
    }

    // 5. Render template
    const dt = new Date(ride.scheduled_at);
    const body = renderTemplate(tmplRow.body, {
      patient_prenom: ride.patient.prenom,
      patient_nom: ride.patient.nom,
      heure: dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      date: dt.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' }),
      chauffeur_prenom: ride.driver?.prenom ?? '',
    });

    // 6. Send via Twilio
    try {
      const result = await sendSms({
        to: ride.patient.telephone,
        body,
        statusCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/webhook/twilio`,
      });
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j1_reminder',
        to_phone: ride.patient.telephone,
        body_rendered: body,
        twilio_message_sid: result.twilio_message_sid,
        delivery_status: 'sent',
        sent_at: new Date().toISOString(),
      });
      sentCount++;
    } catch (e) {
      await supabase.from('sms_messages').insert({
        organization_id: ride.organization_id,
        patient_id: ride.patient.id,
        ride_id: ride.id,
        template_key: 'j1_reminder',
        to_phone: ride.patient.telephone,
        body_rendered: body,
        delivery_status: 'failed',
        delivery_error: e instanceof Error ? e.message : String(e),
      });
      failedCount++;
    }
  }

  return NextResponse.json({
    processed: rides?.length ?? 0,
    sent: sentCount,
    skipped_consent: skippedConsent,
    failed: failedCount,
  });
}
```

## `/api/cron/sms-reminders-j2h/route.ts`

Pattern identique à `j1` avec différences :

- Filtre temps : `scheduled_at BETWEEN now() + interval '1h45m' AND now() + interval '2h15m'`
- Template fetch : `'j2h_reminder'`
- Status `sms_messages.template_key = 'j2h_reminder'`
- Idempotency : check `SELECT 1 FROM sms_messages WHERE ride_id = X AND template_key = 'j2h_reminder' AND created_at > now() - interval '4h'` pour éviter doublons si cron tourne plusieurs fois dans la fenêtre.

---

## `/api/sms/webhook/twilio/route.ts` — HMAC validation (DEC-052)

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Webhook Twilio status callback (DEC-052).
 *
 * Sécurité HMAC SHA1 :
 *   - Compute = HMAC-SHA1(url + sorted POST params, TWILIO_AUTH_TOKEN)
 *   - Header X-Twilio-Signature (base64)
 *   - timingSafeEqual contre timing attacks
 *
 * Body form-urlencoded :
 *   MessageSid, MessageStatus, ErrorCode (si failed), ...
 */
function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string,
  authToken: string,
): boolean {
  // Twilio signature algo : sort POST params alphabétiquement, concat to URL, HMAC-SHA1
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const computed = createHmac('sha1', authToken).update(data).digest('base64');
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const signatureHeader = req.headers.get('x-twilio-signature');
  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) params[k] = String(v);

  const fullUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/webhook/twilio`;
  const valid = validateTwilioSignature(
    fullUrl,
    params,
    signatureHeader,
    process.env.TWILIO_AUTH_TOKEN!,
  );
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const messageSid = params['MessageSid'];
  const messageStatus = params['MessageStatus']; // 'sent' | 'delivered' | 'failed' | 'undelivered'
  const errorCode = params['ErrorCode'];

  if (!messageSid || !messageStatus) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  // Update sms_messages
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const patch: Record<string, unknown> = { delivery_status: messageStatus };
  if (messageStatus === 'delivered') patch.delivered_at = new Date().toISOString();
  if (errorCode) patch.delivery_error = `Twilio error ${errorCode}`;

  const { data, error } = await supabase
    .from('sms_messages')
    .update(patch)
    .eq('twilio_message_sid', messageSid)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || data.length === 0) {
    // Pas d'erreur si introuvable (peut être un SMS test sans tracking)
    return NextResponse.json({ updated: 0 });
  }

  return NextResponse.json({ updated: data.length, status: messageStatus });
}
```

---

## Variables d'environnement Vercel

- `CRON_APP_TOKEN` (cohérent avec Vault secret Wave 1, env var miroir)
- `TWILIO_AUTH_TOKEN` (déjà Wave 4)
- `NEXT_PUBLIC_APP_URL` (ex: `https://tap-web-brown.vercel.app`)
- `SUPABASE_SERVICE_ROLE_KEY` (déjà existant)

Documenter ces 4 variables dans `apps/web/.env.example`.

---

## Test manuel post-deploy

```bash
# Test cron J-1 manuellement
curl -X POST https://tap-web-brown.vercel.app/api/cron/sms-reminders-j1 \
  -H "Authorization: Bearer ${CRON_APP_TOKEN}" \
  -H "Content-Type: application/json"
# Expected : { processed: N, sent: M, skipped_consent: K, failed: 0 }

# Test webhook signature (devrait fail)
curl -X POST https://tap-web-brown.vercel.app/api/sms/webhook/twilio \
  -d "MessageSid=SM123&MessageStatus=delivered"
# Expected : 401 Missing signature

# Vérifier cron schedules actifs côté Supabase SQL
SELECT jobname, schedule FROM cron.job;
# Expected : 2 lignes (sms-reminder-j1, sms-reminder-j2h)

# Vérifier dernières exécutions
SELECT jobname, status, return_message, end_time
FROM cron.job_run_details ORDER BY end_time DESC LIMIT 10;
```

---

## Success criteria Wave 5

1. `/api/cron/sms-reminders-j1` route répond 401 sans Bearer
2. Avec Bearer valide : query rides J+1, applique DEC-008 consent, envoie via Twilio, log `sms_messages`
3. `/api/cron/sms-reminders-j2h` idem avec fenêtre 1h45m-2h15m
4. `/api/sms/webhook/twilio` valide HMAC `X-Twilio-Signature` (401 si invalide)
5. Update `sms_messages.delivery_status` selon callback Twilio
6. pg_cron jobs actifs (vérifié `SELECT * FROM cron.job`)
7. Aucun SMS envoyé sans consent actif (DEC-008 LOCKED)
8. Idempotency J-2h : pas de doublon si cron tourne 2× dans fenêtre 4h
9. `pnpm typecheck` PASS

---

## Risques + Mitigations

- **Timing attack HMAC** : `timingSafeEqual` Node.js natif (pas de `===` direct).
- **Vault secret désynchronisé** : env var Vercel `CRON_APP_TOKEN` doit matcher Vault. Doc déploiement explicite.
- **Service role key côté Route Handler** : exposé seulement côté server (Next.js Route Handler), jamais shipped client. OK.
- **Twilio rate limit** : 200 req/s Twilio default, largement OK pour TAP ~50-200 SMS/jour.
- **Volume J-1 single batch** : si volume futur > 100 SMS, considérer queue async (Phase 06+ Sentry monitoring).

---

## Anti-patterns / NE PAS FAIRE

- ❌ Skip Bearer auth (CRON_APP_TOKEN obligatoire, sinon endpoint = trigger gratuit DoS)
- ❌ Skip HMAC validation webhook (DEC-052 absolu)
- ❌ Envoi SMS sans check consent (DEC-008 absolu)
- ❌ Cache template body (fetch BDD chaque cron pour live updates dirigeant)
- ❌ Envoyer 2× le même rappel J-2h (idempotency check 4h)
- ❌ Service role key côté client (server-side ONLY)
- ❌ Hardcoder phone numbers (toujours fetch BDD)

---

## Commit message proposé

```
feat(05-w5): cron jobs SMS J-1 + J-2h + webhook Twilio HMAC

3 Route Handlers Next.js :
  - POST /api/cron/sms-reminders-j1 (Bearer auth, query rides J+1,
    DEC-008 consent runtime check, Twilio send via packages/sms,
    log sms_messages)
  - POST /api/cron/sms-reminders-j2h (idem fenêtre 1h45m-2h15m,
    idempotency 4h)
  - POST /api/sms/webhook/twilio (HMAC SHA1 X-Twilio-Signature
    timingSafeEqual, update delivery_status)

pg_cron Wave 1 déclenche via pg_net http_post avec Vault secret.

Env vars Vercel : CRON_APP_TOKEN (miroir Vault), TWILIO_AUTH_TOKEN
(déjà W4), NEXT_PUBLIC_APP_URL, SUPABASE_SERVICE_ROLE_KEY.

Refs : DEC-050 RÉVISÉ pg_cron / DEC-052 HMAC / DEC-008 consent
absolu / Source 5 pg_cron+pg_net combo.
```
