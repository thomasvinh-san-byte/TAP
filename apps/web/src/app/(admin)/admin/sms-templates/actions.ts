'use server';

/**
 * Server Actions /admin/sms-templates (Phase 05 Wave 4).
 *
 * Pattern Zod + requireDirigeant + Supabase + audit_logs + DEC-041
 * row count check.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { createClient } from '@/lib/supabase/server';
import { renderTemplate, sendSms, type TemplateVars } from '@tap/sms';

export type SmsTemplateActionState = {
  success?: true;
  error?: string;
  sid?: string;
};

const saveSchema = z.object({
  // SMS-01 : pickup_confirmed éditable comme les rappels (§5.15).
  template_key: z.enum(['j1_reminder', 'j2h_reminder', 'pickup_confirmed']),
  body: z.string().min(1, 'Corps requis').max(160, 'Maximum 160 caractères'),
});

const testSchema = z.object({
  template_key: z.enum(['j1_reminder', 'j2h_reminder', 'pickup_confirmed']),
  to_phone: z.string().regex(/^\+\d{8,15}$/, 'Numéro E.164 attendu (ex: +262692XXXXXX)'),
  patient_prenom: z.string().optional(),
  patient_nom: z.string().optional(),
  heure: z.string().optional(),
  date: z.string().optional(),
  chauffeur_prenom: z.string().optional(),
});

function pickFormData(formData: FormData, keys: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (value === null || value === '') continue;
    obj[key] = value;
  }
  return obj;
}

export async function saveTemplateAction(formData: FormData): Promise<SmsTemplateActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const raw = pickFormData(formData, ['template_key', 'body']);
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();

  const upRes = await supabase
    .from('sms_templates')
    .update({
      body: parsed.data.body,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq('key', parsed.data.template_key)
    .select('key');
  if (upRes.error) return { error: 'Modification refusée.' };
  if (!upRes.data || (upRes.data as unknown[]).length === 0) {
    return { error: 'Modèle introuvable ou droits insuffisants.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'sms_template.update',
    entity_type: 'sms_template',
    entity_id: null,
    metadata: {
      template_key: parsed.data.template_key,
      new_length: parsed.data.body.length,
    },
  });

  revalidatePath('/admin/sms-templates');
  return { success: true };
}

export async function testSendSmsAction(formData: FormData): Promise<SmsTemplateActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const raw = pickFormData(formData, [
    'template_key',
    'to_phone',
    'patient_prenom',
    'patient_nom',
    'heure',
    'date',
    'chauffeur_prenom',
  ]);
  const parsed = testSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();
  const tplRes = await supabase
    .from('sms_templates')
    .select('body')
    .eq('key', parsed.data.template_key)
    .single();
  const tpl = tplRes.data as { body: string } | null;
  if (tplRes.error || !tpl) return { error: 'Modèle introuvable.' };

  const vars: TemplateVars = {
    patient_prenom: parsed.data.patient_prenom,
    patient_nom: parsed.data.patient_nom,
    heure: parsed.data.heure,
    date: parsed.data.date,
    chauffeur_prenom: parsed.data.chauffeur_prenom,
  };
  const rendered = renderTemplate(tpl.body, vars);

  let sid: string;
  try {
    const result = await sendSms({ to: parsed.data.to_phone, body: rendered });
    sid = result.sid;
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'envoi Twilio échoué';
    return { error: reason };
  }

  await supabase.from('sms_messages').insert({
    organization_id: ctx.organizationId,
    patient_id: null,
    ride_id: null,
    template_key: parsed.data.template_key,
    to_phone: parsed.data.to_phone,
    body_rendered: rendered,
    twilio_message_sid: sid,
    delivery_status: 'queued',
  });

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'sms_template.test_send',
    entity_type: 'sms_template',
    entity_id: null,
    metadata: {
      template_key: parsed.data.template_key,
      to_phone: parsed.data.to_phone,
      twilio_sid: sid,
    },
  });

  return { success: true, sid };
}
