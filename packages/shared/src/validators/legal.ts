import { z } from 'zod';

/**
 * Validators zod RGPD compliance — Phase 1.5, D-05..D-09 + D-15.
 * Enums alignés sur les contraintes CHECK de
 * `supabase/migrations/20260508000001_legal_compliance.sql`.
 * Tous les messages d'erreur sont en français.
 */

// ─── data_processing_register (D-05) ─────────────────────────────────────
export const legalBasisEnum = z.enum(
  [
    'consentement',
    'contrat',
    'obligation_legale',
    'mission_interet_public',
    'interet_legitime',
    'sauvegarde_vie',
  ],
  { errorMap: () => ({ message: 'Base légale invalide.' }) },
);

/** Libellés lisibles des bases légales — partagés entre le formulaire et les exports PDF. */
export const legalBasisLabels: Record<z.infer<typeof legalBasisEnum>, string> = {
  consentement: 'Consentement',
  contrat: 'Contrat',
  obligation_legale: 'Obligation légale',
  mission_interet_public: "Mission d'intérêt public",
  interet_legitime: 'Intérêt légitime',
  sauvegarde_vie: 'Sauvegarde des intérêts vitaux',
};

export const dataProcessingRegisterSchema = z.object({
  purpose: z.string().trim().min(1, { message: 'Finalité requise.' }).max(500),
  legal_basis: legalBasisEnum,
  data_categories: z
    .array(z.string().trim().min(1))
    .min(1, { message: 'Au moins une catégorie de données requise.' }),
  data_subjects: z
    .array(z.string().trim().min(1))
    .min(1, { message: 'Au moins une catégorie de personnes concernées requise.' }),
  recipients: z
    .array(z.string().trim().min(1))
    .min(1, { message: 'Au moins un destinataire requis.' }),
  retention_period_days: z
    .number()
    .int()
    .min(1, { message: 'Durée de conservation requise.' })
    .max(36500),
  security_measures: z
    .string()
    .trim()
    .min(1, { message: 'Mesures de sécurité requises.' })
    .max(2000),
  international_transfer: z.boolean(),
  international_transfer_safeguards: z.string().trim().max(2000).optional().nullable(),
});

// ─── dpa_record (D-06) ──────────────────────────────────────────────────
export const dpaRecordSchema = z.object({
  subprocessor_name: z.string().trim().min(1, { message: 'Nom du sous-traitant requis.' }).max(200),
  subprocessor_role: z.string().trim().min(1).max(100),
  dpa_version: z.string().trim().min(1).max(100),
  dpa_document_url: z.string().url({ message: 'URL invalide.' }).optional().nullable(),
  signed_at: z.coerce.date(),
  expires_at: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ─── dpia_record (D-07) ─────────────────────────────────────────────────
export const dpiaStatusEnum = z.enum(['brouillon', 'validee', 'archivee']);
export const dpiaResidualRiskEnum = z.enum(['faible', 'moyen', 'eleve']);

export const dpiaSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Titre requis.' }).max(200),
    scope: z.string().trim().min(1, { message: 'Périmètre requis.' }).max(2000),
    data_flow_diagram: z.string().max(10000).optional().nullable(),
    risks_identified: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          severity: z.string(),
        }),
      )
      .default([]),
    mitigations: z.array(z.object({ risk_id: z.string(), measure: z.string() })).default([]),
    residual_risk_level: dpiaResidualRiskEnum,
    cnil_consultation_required: z.boolean(),
    cnil_consultation_date: z.coerce.date().optional().nullable(),
    reviewed_at: z.coerce.date(),
    next_review_at: z.coerce.date(),
    status: dpiaStatusEnum,
  })
  .refine((d) => d.next_review_at > d.reviewed_at, {
    message: 'La prochaine revue doit être postérieure à la date de revue.',
    path: ['next_review_at'],
  });

// ─── data_breach_incident (D-08) ────────────────────────────────────────
export const breachSeverityEnum = z.enum(['faible', 'moyen', 'eleve', 'critique']);
export const breachNatureEnum = z.enum(['confidentialite', 'integrite', 'disponibilite']);

export const breachIncidentSchema = z.object({
  detected_at: z.coerce.date(),
  severity: breachSeverityEnum,
  nature: breachNatureEnum,
  affected_data_categories: z.array(z.string().trim().min(1)).min(1),
  affected_subjects_count: z.number().int().min(0).optional().nullable(),
  description: z.string().trim().min(1, { message: 'Description requise.' }).max(5000),
  immediate_measures: z
    .string()
    .trim()
    .min(1, { message: 'Mesures immédiates requises.' })
    .max(5000),
  cnil_notification_required: z.boolean(),
  cnil_notification_at: z.coerce.date().optional().nullable(),
  cnil_notification_reference: z.string().trim().max(100).optional().nullable(),
  subjects_notification_required: z.boolean(),
  subjects_notified_at: z.coerce.date().optional().nullable(),
});

// ─── patient_data_request (D-09) ────────────────────────────────────────
export const dataRequestTypeEnum = z.enum([
  'acces',
  'rectification',
  'effacement',
  'limitation',
  'portabilite',
  'opposition',
]);
export const dataRequestStatusEnum = z.enum([
  'recue',
  'en_cours',
  'satisfaite',
  'rejetee',
  'partiellement_satisfaite',
]);

export const dataRequestSchema = z.object({
  patient_id: z.string().uuid().optional().nullable(),
  request_type: dataRequestTypeEnum,
  requester_email: z.string().email({ message: 'Email invalide.' }).optional().nullable(),
  requested_at: z.coerce.date().default(() => new Date()),
});

// ─── DPO contact (D-15) ─────────────────────────────────────────────────
export const dpoContactSchema = z.object({
  dpo_contact_email: z.string().email({ message: 'Email DPO invalide.' }).optional().nullable(),
  dpo_contact_phone: z.string().trim().max(40).optional().nullable(),
  dpo_contact_address: z.string().trim().max(500).optional().nullable(),
  dpo_external: z.boolean().default(false),
});

export type DataProcessingRegisterInput = z.infer<typeof dataProcessingRegisterSchema>;
export type DpaRecordInput = z.infer<typeof dpaRecordSchema>;
export type DpiaInput = z.infer<typeof dpiaSchema>;
export type BreachIncidentInput = z.infer<typeof breachIncidentSchema>;
export type DataRequestInput = z.infer<typeof dataRequestSchema>;
export type DpoContactInput = z.infer<typeof dpoContactSchema>;
