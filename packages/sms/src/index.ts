export { renderTemplate, TEMPLATE_VARIABLES } from './template-renderer';
export type { TemplateVars, TemplateVariable } from './template-renderer';

export { hasActiveSmsConsent } from './consent-checker';

export { sendSms } from './twilio-adapter';
export type { SendSmsParams, SendSmsResult } from './twilio-adapter';
