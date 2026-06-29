import 'server-only';
import type { SendSmsParams, SendSmsResult } from './sms-types';
import { sendSmsViaTwilio } from './twilio-adapter';
import { sendSmsViaSovereign } from './sovereign-adapter';

export type { SendSmsParams, SendSmsResult } from './sms-types';

/**
 * Point d'entrée unique d'envoi SMS (OVH-03). Le fournisseur est choisi par
 * `SMS_PROVIDER` (défaut : `twilio`, pour rétrocompat stricte : aujourd'hui la
 * variable est absente ou vaut `twilio` → comportement identique). La bascule
 * vers un fournisseur souverain HDS (ADR-004) se fera en posant
 * `SMS_PROVIDER=sovereign` + intégration de `sovereign-adapter`.
 */
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const provider = process.env.SMS_PROVIDER ?? 'twilio';
  switch (provider) {
    case 'twilio':
      return sendSmsViaTwilio(params);
    // Cibles ADR-004 (toutes vers le squelette tant que non intégré).
    case 'sovereign':
    case 'smsmode':
    case 'octopush':
    case 'ovh':
      return sendSmsViaSovereign(params);
    default:
      throw new Error(
        `SMS_PROVIDER inconnu : '${provider}' (attendu : twilio | sovereign | smsmode | octopush | ovh).`,
      );
  }
}
