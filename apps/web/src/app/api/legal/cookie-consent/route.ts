import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/legal/cookie-consent — log audit du consentement cookies (D-14).
 *
 * Visiteur anonyme — ne nécessite pas de session Supabase. Insertion via
 * service_role dans `cookie_consent_log` (RLS service_role-only). Aucune
 * IP ni user-agent en clair : SHA-256 du user-agent + token de session
 * aléatoire serveur (jamais lié à un compte). Mitige T-1.5-15.
 */

export const runtime = 'nodejs'; // service_role + crypto Node

const bodySchema = z.object({
  choices: z.object({
    technique: z.literal(true),
    analytics: z.boolean(),
    marketing: z.boolean(),
  }),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choix de cookies invalide.' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent') ?? 'unknown';
  const userAgentHash = crypto.createHash('sha256').update(userAgent).digest('hex');
  const sessionToken = crypto.randomBytes(16).toString('hex');
  const sessionTokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

  const supabase = createAdminClient();
  const { error } = await supabase.from('cookie_consent_log').insert({
    session_token_hash: sessionTokenHash,
    choices: parsed.data.choices,
    user_agent_hash: userAgentHash,
  });
  if (error) {
    return NextResponse.json(
      { error: 'Enregistrement du consentement impossible.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
