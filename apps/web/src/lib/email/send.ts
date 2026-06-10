/**
 * Module d'envoi email central — la COUTURE (Phase 06.64, DEC-144, CdC §5.22).
 *
 * Échafaudage derrière le release toggle `EMAIL_ENABLED` (évalué côté serveur).
 * AUCUN provider n'est choisi/installé (registre §1.2) — `sendEmail` est un
 * **no-op honnête loggé**, jamais un faux envoi :
 *   - OFF (défaut prod)  → `{ skipped: true }`, log `[email:disabled]`.
 *   - ON (dev)           → `{ sent: false, reason: 'no-provider' }`, log
 *     `[email:no-provider]`. Le vrai branchement (Resend/SMTP/…) sera un lot
 *     dédié quand le provider sera choisi — c'est ICI qu'il se grefferra.
 *
 * Ne lève jamais : un échec de notification ne doit pas casser l'action métier.
 * Périmètre minimal volontaire : `subject` + `body` texte (pas de templating).
 */
export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export type SendEmailResult =
  | { skipped: true }
  | { sent: false; reason: 'no-provider' }
  | { sent: true };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const enabled = process.env.EMAIL_ENABLED === 'true';

  if (!enabled) {
    console.info('[email:disabled]', { to: input.to, subject: input.subject });
    return { skipped: true };
  }

  // Flag ON mais aucun provider câblé : no-op explicite (pas de faux envoi).
  console.info('[email:no-provider]', { to: input.to, subject: input.subject });
  return { sent: false, reason: 'no-provider' };
}
