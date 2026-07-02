import { NextResponse, type NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database';

/**
 * Webhook Twilio status callback (DEC-052 LOCKED).
 *
 * Configuration côté Twilio (manuel, console Twilio) :
 *   Phone Number → Messaging → Webhook
 *   URL    = https://tap-web-brown.vercel.app/api/sms/webhook/twilio
 *   Method = HTTP POST
 *
 * Sécurité HMAC SHA1 (algo officiel Twilio) :
 *   - compute = HMAC-SHA1(URL + sorted POST params concat, TWILIO_AUTH_TOKEN)
 *   - signature base64 dans header `X-Twilio-Signature`
 *   - timingSafeEqual sur buffers de longueur identique (anti timing-attack)
 *
 * Body form-urlencoded : MessageSid, MessageStatus, ErrorCode (si failed),
 * AccountSid, etc.
 *
 * Status Twilio possibles : queued / sent / delivered / failed /
 * undelivered / sending. On map vers `sms_messages.delivery_status`
 * (sauf `sending` ignoré silencieusement, état transitoire).
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPPORTED_STATUSES = new Set(['queued', 'sent', 'delivered', 'failed', 'undelivered']);

function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signatureHeader: string,
  authToken: string,
): boolean {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const computed = createHmac('sha1', authToken).update(data).digest('base64');

  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signatureHeader);
  if (computedBuf.length !== signatureBuf.length) return false;
  try {
    return timingSafeEqual(computedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const signatureHeader = req.headers.get('x-twilio-signature');
  if (!signatureHeader) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!authToken || !appUrl) {
    return NextResponse.json(
      { error: 'Config manquante (TWILIO_AUTH_TOKEN ou NEXT_PUBLIC_APP_URL)' },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    params[k] = String(v);
  }

  const fullUrl = `${appUrl}/api/sms/webhook/twilio`;
  if (!validateTwilioSignature(fullUrl, params, signatureHeader, authToken)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const messageSid = params['MessageSid'];
  const messageStatus = params['MessageStatus'];
  const errorCode = params['ErrorCode'];

  if (!messageSid || !messageStatus) {
    return NextResponse.json(
      { error: 'Missing required params (MessageSid or MessageStatus)' },
      { status: 400 },
    );
  }

  if (!SUPPORTED_STATUSES.has(messageStatus)) {
    return NextResponse.json({ ignored: true, status: messageStatus });
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const patch: Record<string, unknown> = { delivery_status: messageStatus };
  if (messageStatus === 'delivered') {
    patch.delivered_at = new Date().toISOString();
  }
  if (errorCode) {
    patch.delivery_error = `Twilio error ${errorCode}`;
  }

  const upRes = await supabase
    .from('sms_messages')
    .update(patch)
    .eq('twilio_message_sid', messageSid)
    .select('id');
  if (upRes.error) {
    return NextResponse.json({ error: upRes.error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: (upRes.data as unknown[] | null)?.length ?? 0 });
}
