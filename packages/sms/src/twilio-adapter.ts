import 'server-only';

/**
 * Wrapper Twilio SDK pour envoi SMS sortant.
 *
 * `import 'server-only'` (Next.js 14 natif) — défense en profondeur :
 * tout composant client qui tenterait d'importer ce module obtiendrait
 * une erreur de compilation explicite. Le hotfix `@tap/sms/templates`
 * sub-path expose la partie browser-safe (template-renderer pur JS).
 *
 * Env vars requises (Server Action / Route Handler côté serveur) :
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_PHONE_NUMBER
 *
 * Si l'une est manquante : throw error explicite (fail-fast).
 *
 * Le SDK est importé en lazy (await import) pour ne pas tirer
 * twilio dans le bundle frontend Next.js si jamais le module est
 * importé par erreur côté client.
 */

export interface SendSmsParams {
  to: string;
  body: string;
  statusCallback?: string;
}

export interface SendSmsResult {
  sid: string;
}

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error(
      'Twilio non configuré. Vérifier TWILIO_ACCOUNT_SID, ' +
        'TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER côté Vercel.',
    );
  }

  const twilioModule = await import('twilio');
  const twilio = (twilioModule as unknown as { default: (sid: string, token: string) => unknown })
    .default;
  const client = twilio(accountSid, authToken) as {
    messages: {
      create: (opts: {
        to: string;
        from: string;
        body: string;
        statusCallback?: string;
      }) => Promise<{ sid: string }>;
    };
  };

  const message = await client.messages.create({
    to: params.to,
    from: fromNumber,
    body: params.body,
    ...(params.statusCallback && { statusCallback: params.statusCallback }),
  });

  return { sid: message.sid };
}
