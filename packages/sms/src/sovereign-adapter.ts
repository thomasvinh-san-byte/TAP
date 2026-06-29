import 'server-only';
import type { SendSmsParams, SendSmsResult } from './sms-types';

/**
 * Adaptateur SMS souverain (cible ADR-004 : smsmode ISO 27001/HDS, Octopush, ou
 * OVH SMS ; plan B RaspiSMS auto-hébergé). ÉCHAFAUDAGE : la structure est prête,
 * l'intégration réelle se fera dans un lot dédié au moment du choix du
 * fournisseur (compte + API testable). Doctrine projet : pas de code mort
 * simulant un faux succès → fail-fast explicite tant que c'est non implémenté.
 */
export async function sendSmsViaSovereign(_params: SendSmsParams): Promise<SendSmsResult> {
  throw new Error(
    'Adaptateur SMS souverain non implémenté. Choisir et intégrer le fournisseur ' +
      'HDS (smsmode / Octopush / OVH SMS) — cf. ADR-004. Tant que SMS_PROVIDER vaut ' +
      "'sovereign', l'envoi échoue volontairement (pas de faux succès).",
  );
}
