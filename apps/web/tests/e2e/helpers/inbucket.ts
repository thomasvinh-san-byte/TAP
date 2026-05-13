/**
 * Helper Inbucket — réutilisable par les specs E2E (PLAN-5 §5.1, C08).
 *
 * Inbucket = mailserver SMTP local utilisé par Supabase pour capturer les
 * emails d'invitation en environnement dev / CI cloud (cf. CLAUDE.md § 13.5).
 *
 * En CI cloud (GitHub Actions `preview-smoke.yml`), Inbucket est démarré dans
 * le runner via `supabase start` (cf. workflow). En local développeur, idem.
 *
 * API Inbucket v1 :
 *   - DELETE /api/v1/mailbox/:mailbox     → purge complète d'une mailbox
 *   - GET    /api/v1/mailbox/:mailbox     → liste des messages reçus
 *   - GET    /api/v1/mailbox/:mailbox/:id → corps complet d'un message
 *
 * Le port par défaut Supabase pour Inbucket est 54324. Override possible via
 * `INBUCKET_URL` pour environnements alternatifs.
 */

import type { APIRequestContext } from '@playwright/test';

const INBUCKET_BASE = process.env.INBUCKET_URL ?? 'http://localhost:54324';

/**
 * Reset complet d'une mailbox Inbucket (toutes les invitations test).
 *
 * À appeler en `beforeEach` (Q4.2 — isolation entre runs Playwright). Si la
 * mailbox n'existe pas encore, Inbucket renvoie 200 silencieux : pas d'erreur.
 */
export async function resetInbucketMailbox(
  request: APIRequestContext,
  mailbox: string,
): Promise<void> {
  await request.delete(`${INBUCKET_BASE}/api/v1/mailbox/${mailbox}`);
}

/**
 * Récupère le dernier email reçu sur une mailbox + extrait l'URL d'activation.
 *
 * Polling 10 × 1 s pour laisser l'invitation Supabase arriver côté Inbucket
 * (le push email est async côté Auth service). Lève si aucun email après 10s.
 *
 * Le template Supabase pour `inviteUserByEmail` contient `{{ .ConfirmationURL }}`
 * qui pointe vers `<redirectTo>` après échange de token. Avec la déviation
 * PLAN-4 (Route Handler déplacé), l'URL aura la forme :
 *   http://localhost:3000/accept-invite/verify?token_hash=...&type=invite
 *
 * Le regex matche aussi bien `/accept-invite` que `/accept-invite/verify`
 * (le `verify` est capturé par l'alternative `verify` du groupe).
 */
export async function fetchLatestInviteUrl(
  request: APIRequestContext,
  mailbox: string,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const res = await request.get(`${INBUCKET_BASE}/api/v1/mailbox/${mailbox}`);
    if (res.ok()) {
      const messages = (await res.json()) as Array<{ id: string }>;
      if (messages.length > 0) {
        const detail = await request.get(
          `${INBUCKET_BASE}/api/v1/mailbox/${mailbox}/${messages[0].id}`,
        );
        const body = (await detail.json()) as {
          body: { text: string; html: string };
        };
        const text = body.body.text ?? body.body.html ?? '';
        const match = text.match(
          /https?:\/\/[^\s)"<]+(?:accept-invite|verify)[^\s)"<]*/,
        );
        if (match) return match[0];
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Aucun email d'invitation reçu pour ${mailbox} après 10s.`);
}
