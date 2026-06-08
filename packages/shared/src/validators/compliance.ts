import { z } from 'zod';

/**
 * Conformité réglementaire métier (CdC §5.21, Phase 06.33, DEC-112).
 *
 * Centralisation des types d'échéances + libellés FR pour éviter le
 * hardcode dispersé (NFR-001). Aligne avec le CHECK SQL de
 * `compliance_items.kind` (migration 20260608000001).
 *
 * Distinct du suivi RGPD documentaire (registre/DPA/DPIA).
 */

export const COMPLIANCE_KINDS = [
  'carte_pro',
  'visite_medicale',
  'formation_continue',
  'controle_technique',
  'visite_taxi',
  'assurance',
  'licence_taxi',
  'convention_cgss',
] as const;

export type ComplianceKind = (typeof COMPLIANCE_KINDS)[number];

export const COMPLIANCE_ENTITY_TYPES = ['driver', 'vehicle', 'organization'] as const;
export type ComplianceEntityType = (typeof COMPLIANCE_ENTITY_TYPES)[number];

/** Libellé FR du type d'échéance (NFR-001, aucun hardcode dans l'UI). */
export const COMPLIANCE_LABELS: Record<ComplianceKind, string> = {
  carte_pro: 'Carte professionnelle',
  visite_medicale: 'Visite médicale d’aptitude',
  formation_continue: 'Formation continue obligatoire',
  controle_technique: 'Contrôle technique',
  visite_taxi: 'Visite annuelle taxi (préfecture)',
  assurance: 'Assurance',
  licence_taxi: 'Licence taxi',
  convention_cgss: 'Convention CGSS',
};

/** Types attendus par entité (UI : sections pré-définies). */
export const COMPLIANCE_KINDS_BY_ENTITY: Record<ComplianceEntityType, ComplianceKind[]> = {
  driver: ['carte_pro', 'visite_medicale', 'formation_continue'],
  vehicle: ['controle_technique', 'visite_taxi', 'assurance', 'licence_taxi'],
  organization: ['convention_cgss'],
};

/**
 * Validateur input upsert (création + MAJ).
 *
 * `id` optionnel — présent en MAJ, absent en création. La Server Action
 * applique le row-count check DEC-041 sur l'UPDATE pour échouer
 * explicitement si la ligne n'appartient pas à l'organisation.
 */
export const complianceItemUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    entity_type: z.enum(COMPLIANCE_ENTITY_TYPES),
    entity_id: z.string().uuid().nullable(),
    kind: z.enum(COMPLIANCE_KINDS),
    label: z.string().trim().max(120).optional().or(z.literal('')),
    reference: z.string().trim().max(80).optional().or(z.literal('')),
    issued_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.')
      .optional()
      .or(z.literal('')),
    expires_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.')
      .optional()
      .or(z.literal('')),
  })
  .refine(
    (v) =>
      (v.entity_type === 'organization' && v.entity_id === null) ||
      (v.entity_type !== 'organization' && !!v.entity_id),
    {
      message: 'entity_id requis pour driver/vehicle ; null pour organization.',
      path: ['entity_id'],
    },
  );

export type ComplianceItemUpsertInput = z.infer<typeof complianceItemUpsertSchema>;
