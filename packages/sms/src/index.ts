export { renderTemplate, TEMPLATE_VARIABLES } from './template-renderer';
export type { TemplateVars, TemplateVariable } from './template-renderer';

export { hasActiveSmsConsent, getActiveSmsConsentMap, isConsentValid } from './consent-checker';
export type { SmsConsentRow } from './consent-checker';

export { sendSms } from './sms-adapter';
export type { SendSmsParams, SendSmsResult } from './sms-adapter';
