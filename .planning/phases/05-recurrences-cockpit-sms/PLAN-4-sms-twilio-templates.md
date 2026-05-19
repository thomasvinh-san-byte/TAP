# Plan-4 — packages/sms + Twilio adapter + templates UI admin

**Phase**: 05
**Wave**: 4/7
**Dépendances**: Wave 1 (migrations sms_messages + sms_templates)
**Estimation**: 2h (vélocité projetée 25-40 min réel)
**Refs**: DEC-008 consentement SMS LOCKED, DEC-051 Mustache custom 5 vars, DEC-003 stack figée (Twilio), DEC-013 ≥80% packages/sms, Source 3 Twilio Content API (Phase 06), Source 8 SMS FR/créole 974

---

## Goal

Moteur SMS Twilio dans `packages/sms` + UI admin templates éditables `/admin/sms-templates`. Helper consent runtime check (DEC-008 absolu). Mustache custom 5 variables (DEC-051) sans dépendance Handlebars.

---

## Fichiers à créer (9)

### `packages/sms/` (5 fichiers)

```
packages/sms/
  package.json
  tsconfig.json
  vitest.config.ts                    # Coverage ≥80% DEC-013
  src/index.ts                        # Public API exports
  src/twilio-adapter.ts               # Wrapper SDK twilio npm
  src/template-renderer.ts            # Mustache custom 5 vars
  src/consent-checker.ts              # DEC-008 check runtime
  src/__tests__/template-renderer.test.ts
  src/__tests__/consent-checker.test.ts
```

### UI admin templates (4 fichiers)

```
apps/web/src/app/(admin)/admin/sms-templates/
  page.tsx                            # Server Component liste 2 templates
  actions.ts                          # save template + test send
  _components/
    template-editor.client.tsx        # Textarea 160 chars + variables + preview
    template-test-modal.client.tsx    # Modal numéro test
```

---

## `packages/sms` — Code

### `package.json`

```json
{
  "name": "@tap/sms",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "twilio": "^5.3.0"
  },
  "devDependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "@vitest/coverage-v8": "^2.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

### `src/template-renderer.ts`

```ts
/**
 * Mustache custom 5 variables (DEC-051).
 * Pas de dépendance Handlebars (40 KB over-engineered V1.5).
 *
 * Variables supportées :
 *   - {{patient_prenom}}
 *   - {{patient_nom}}
 *   - {{heure}}
 *   - {{date}}
 *   - {{chauffeur_prenom}}
 *
 * Variables non listées remplacées par chaîne vide (safe).
 */
export interface TemplateVars {
  patient_prenom?: string;
  patient_nom?: string;
  heure?: string;
  date?: string;
  chauffeur_prenom?: string;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return (vars as Record<string, string | undefined>)[key] ?? '';
  });
}
```

### `src/consent-checker.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Check DEC-008 runtime consentement SMS actif horodaté.
 * AUCUN cache "vu il y a 5 min" — query BDD à chaque envoi.
 *
 * Champ patients.sms_consent_active_at NULL = pas de consentement.
 * Champ patients.preferred_contact_method = 'sms' OU 'appel' OU 'aucun' (SMS-06).
 *
 * @returns true SI consentement actif ET preference autorise SMS
 */
export async function hasActiveSmsConsent(
  supabase: SupabaseClient,
  patientId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('patients')
    .select('sms_consent_active_at, preferred_contact_method')
    .eq('id', patientId)
    .single();
  if (error || !data) return false;
  if (!data.sms_consent_active_at) return false;
  if (data.preferred_contact_method === 'aucun') return false;
  // 'sms' explicite OU 'appel' default (l'appel ne bloque pas le SMS si consent actif)
  return data.preferred_contact_method !== 'aucun';
}
```

### `src/twilio-adapter.ts`

```ts
/**
 * Wrapper SDK twilio npm avec lazy import.
 *
 * En cas de dev/test sans env Twilio configuré, throw clair plutôt
 * que crash cryptique.
 */
export interface SmsResult {
  twilio_message_sid: string;
  status: string;
}

export async function sendSms(input: {
  to: string;
  body: string;
  statusCallbackUrl?: string;
}): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !fromPhone) {
    throw new Error('Twilio env vars manquantes (TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER)');
  }
  const twilio = (await import('twilio')).default;
  const client = twilio(accountSid, authToken);
  const message = await client.messages.create({
    to: input.to,
    from: fromPhone,
    body: input.body,
    statusCallback: input.statusCallbackUrl,
  });
  return { twilio_message_sid: message.sid, status: message.status };
}
```

### `src/index.ts`

```ts
export { renderTemplate } from './template-renderer';
export type { TemplateVars } from './template-renderer';
export { hasActiveSmsConsent } from './consent-checker';
export { sendSms } from './twilio-adapter';
export type { SmsResult } from './twilio-adapter';
```

### Tests sample (`template-renderer.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../template-renderer';

describe('renderTemplate', () => {
  it('remplace 5 variables', () => {
    const out = renderTemplate(
      'Bonjour {{patient_prenom}}, course {{date}} à {{heure}} avec {{chauffeur_prenom}}.',
      { patient_prenom: 'Patrick', date: '20/05/26', heure: '08:00', chauffeur_prenom: 'Jean' }
    );
    expect(out).toBe('Bonjour Patrick, course 20/05/26 à 08:00 avec Jean.');
  });
  it('variable manquante → chaîne vide safe', () => {
    expect(renderTemplate('Bonjour {{patient_prenom}}', {})).toBe('Bonjour ');
  });
  it('variable inconnue → chaîne vide safe', () => {
    expect(renderTemplate('{{unknown_var}}', {})).toBe('');
  });
});
```

`consent-checker.test.ts` : mock Supabase client (3 cas — consent OK / consent NULL → false / preferred 'aucun' → false).

---

## UI admin `/admin/sms-templates`

### `page.tsx`

```tsx
import { requireDirigeant } from '@/lib/auth/require-dirigeant-page';
import { createClient } from '@/lib/supabase/server';
import { TemplateEditor } from './_components/template-editor.client';

export default async function SmsTemplatesPage() {
  await requireDirigeant();
  const supabase = createClient();
  const { data: templates } = await supabase
    .from('sms_templates')
    .select('key, body, updated_at')
    .order('key');

  return (
    <div className="max-w-[960px] mx-auto px-24 py-24 space-y-32">
      <h1 className="text-2xl font-semibold">Templates SMS</h1>
      {(templates ?? []).map((t) => (
        <TemplateEditor key={t.key} template={t} />
      ))}
    </div>
  );
}
```

### `template-editor.client.tsx` (sketch)

```tsx
'use client';
import { useState } from 'react';
import { renderTemplate } from '@tap/sms';
import { saveTemplateAction, testSendTemplateAction } from '../actions';

const VARIABLES = ['patient_prenom', 'patient_nom', 'heure', 'date', 'chauffeur_prenom'];

const PREVIEW_VARS = {
  patient_prenom: 'Patrick',
  patient_nom: 'Hoarau',
  heure: '08:00',
  date: 'lun 20 mai',
  chauffeur_prenom: 'Jean',
};

export function TemplateEditor({ template }) {
  const [body, setBody] = useState(template.body);
  const [testOpen, setTestOpen] = useState(false);
  const count = body.length;
  const over = count > 160;
  const preview = renderTemplate(body, PREVIEW_VARS);

  const insertVar = (v: string) => {
    setBody((b) => b + `{{${v}}}`);
  };

  return (
    <section className="border rounded-md p-16 space-y-12">
      <h2 className="font-medium">{template.key === 'j1_reminder' ? 'Rappel J-1 (18h)' : 'Rappel J-2h'}</h2>
      <div className="grid grid-cols-2 gap-16">
        <div className="space-y-8">
          <textarea
            className="w-full h-32 border rounded-md p-12 font-mono text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className={`text-xs ${over ? 'text-destructive' : 'text-muted-foreground'}`}>{count} / 160</div>
          <div className="flex flex-wrap gap-4">
            {VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => insertVar(v)}
                className="text-xs border rounded px-6 py-2 hover:bg-muted">
                {`{{${v}}}`}
              </button>
            ))}
          </div>
        </div>
        <div className="border rounded-md p-12 bg-muted/30">
          <div className="text-xs font-medium mb-4">Preview (Mme Hoarau, lun)</div>
          <div className="text-sm whitespace-pre-wrap">{preview}</div>
        </div>
      </div>
      <div className="flex gap-8">
        <form action={saveTemplateAction}>
          <input type="hidden" name="key" value={template.key} />
          <input type="hidden" name="body" value={body} />
          <Button type="submit" disabled={over}>Enregistrer</Button>
        </form>
        <Button variant="outline" onClick={() => setTestOpen(true)}>Tester l'envoi</Button>
      </div>
      {testOpen && <TemplateTestModal templateKey={template.key} body={body} onClose={() => setTestOpen(false)} />}
    </section>
  );
}
```

### `actions.ts`

```ts
'use server';
import { z } from 'zod';
import { renderTemplate, sendSms } from '@tap/sms';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { revalidatePath } from 'next/cache';

const saveSchema = z.object({
  key: z.enum(['j1_reminder', 'j2h_reminder']),
  body: z.string().min(1).max(160), // DEC-051 + Source 8 160 chars max
});

export async function saveTemplateAction(formData: FormData) {
  const ctx = await requireDirigeant();
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const { data, error } = await ctx.supabase
    .from('sms_templates')
    .update({ body: parsed.data.body, updated_by: ctx.user_id, updated_at: new Date().toISOString() })
    .eq('key', parsed.data.key)
    .select('key');
  if (error) return { error: 'Save échoué.' };
  if (!data || data.length === 0) return { error: 'Template introuvable (RLS).' }; // DEC-041

  // Audit log SMS-07
  await ctx.supabase.from('audit_logs').insert({
    actor_id: ctx.user_id,
    action_type: 'sms_template.update',
    payload: { key: parsed.data.key, body_length: parsed.data.body.length },
  });

  revalidatePath('/admin/sms-templates');
  return { success: true };
}

const testSchema = z.object({
  templateKey: z.enum(['j1_reminder', 'j2h_reminder']),
  body: z.string().min(1).max(160),
  toPhone: z.string().regex(/^\+\d{8,15}$/), // E.164
});

export async function testSendTemplateAction(formData: FormData) {
  const ctx = await requireDirigeant();
  const parsed = testSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };

  const rendered = renderTemplate(parsed.data.body, {
    patient_prenom: 'Patrick',
    patient_nom: 'Hoarau',
    heure: '08:00',
    date: 'lun 20 mai',
    chauffeur_prenom: 'Jean',
  });

  try {
    const result = await sendSms({ to: parsed.data.toPhone, body: rendered });
    await ctx.supabase.from('sms_messages').insert({
      organization_id: ctx.organization_id,
      template_key: 'manual', // test, pas auto
      to_phone: parsed.data.toPhone,
      body_rendered: rendered,
      twilio_message_sid: result.twilio_message_sid,
      delivery_status: 'sent',
      sent_at: new Date().toISOString(),
    });
    return { success: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Envoi échoué.' };
  }
}
```

---

## Variables d'environnement Vercel à configurer

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

(documenter dans `apps/web/.env.example` + console Vercel Dashboard)

---

## Success criteria Wave 4

1. `packages/sms` `pnpm test --coverage` ≥ 80% (DEC-013)
2. `renderTemplate` test 100% branches (5 cas : variables présentes / manquantes / inconnues / vides)
3. `hasActiveSmsConsent` test mock Supabase (3 cas)
4. `/admin/sms-templates` accessible dirigeant seulement
5. Counter 160 chars actif (rouge si over)
6. Variables clickables insert au caret
7. Preview live side-by-side
8. Dirigeant clique « Tester l'envoi » → reçoit SMS test à son numéro
9. `audit_logs` trace save (SMS-07)
10. `pnpm typecheck` PASS

---

## Risques + Mitigations

- **Twilio env vars en dev** : `sendSms` throw clair si manquant, dev local sans Twilio possible (UI only).
- **160 chars** : counter UI visible + Zod `.max(160)` côté Server Action (defense-in-depth).
- **Test send vrais SMS** : coûts Twilio ~0.04€/SMS test. Documenter coût dans page admin (« Coût ~0.04€ par test »).
- **NFR-001 noms propres** : Preview vars utilise seed démo (Patrick Hoarau / Jean), pas hardcoded code → OK.

---

## Anti-patterns / NE PAS FAIRE

- ❌ Handlebars npm dependency (DEC-051 Mustache custom suffit, 40 KB économisés)
- ❌ Template > 160 chars (counter rouge bloquant submit, Zod max)
- ❌ Cache consent runtime (DEC-008 absolu, query à chaque envoi)
- ❌ Templates créole hardcoded (V1.5 FR standard, créole option Phase 06)
- ❌ Webhook delivery dans cette wave (Wave 5)
- ❌ Cron auto envoi dans cette wave (Wave 5)

---

## Commit message proposé

```
feat(05-w4): packages/sms Twilio + UI admin templates 160 chars

packages/sms : sendSms wrapper SDK twilio lazy import,
renderTemplate Mustache custom 5 vars (DEC-051), hasActiveSmsConsent
runtime check (DEC-008). Vitest ≥80% (DEC-013).

UI admin /admin/sms-templates : 2 cards éditables (j1_reminder +
j2h_reminder), textarea 160 chars counter, variables clickables
insert, preview side-by-side seed démo. Server Actions save +
test send + audit logs (SMS-07).

Env vars TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER à configurer
Vercel.

Refs : DEC-008/051/013/003, Source 3 Twilio Content API (Phase 06),
Source 8 SMS FR/créole 974.
```
