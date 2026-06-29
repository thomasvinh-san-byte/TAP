/**
 * Types partagés des adaptateurs SMS (OVH-03).
 *
 * Centralisés ici pour que tous les adapters (twilio / souverain) et le
 * dispatcher les partagent sans dépendance circulaire. Interfaces préservées
 * À L'IDENTIQUE de l'ancien `twilio-adapter.ts` (rétrocompat des appelants).
 */

export interface SendSmsParams {
  to: string;
  body: string;
  statusCallback?: string;
}

export interface SendSmsResult {
  sid: string;
}
