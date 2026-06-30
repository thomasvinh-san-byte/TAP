import { z } from 'zod';
import { finessSchema } from './common';

/**
 * Prescriptions / bons de transport (CdG §5.3, DEC-163).
 *
 * Saisie structurée (pas de scan — document_url reste NULL, Phase 09 HDS) +
 * dérivation PURE des alertes (compteur de trajets / expiration / renouvellement),
 * testable et partagée serveur/UI comme `selectComplianceAlerts`.
 */
export const PRESCRIPTION_STATUS_VALUES = ['active', 'epuisee', 'expiree'] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUS_VALUES)[number];

export const prescriptionInputSchema = z.object({
  patient_id: z.string().uuid('Patient requis'),
  prescriber_id: z.string().uuid().nullable().optional(),
  numero: z
    .string()
    .trim()
    .min(1, 'Le numéro du bon est requis.')
    .max(60, 'Le numéro doit faire au maximum 60 caractères.'),
  date_prescription: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de prescription invalide.'),
  finess: finessSchema.optional().or(z.literal('')),
  motif: z.string().trim().max(200).optional().or(z.literal('')),
  type_transport: z.string().trim().max(60).optional().or(z.literal('')),
  trajets_autorises: z.coerce
    .number()
    .int('Nombre de trajets invalide.')
    .min(1, 'Au moins 1 trajet autorisé.')
    .max(999, 'Maximum 999 trajets.'),
  date_expiration: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'expiration invalide.")
    .optional()
    .or(z.literal('')),
});

export type PrescriptionInput = z.infer<typeof prescriptionInputSchema>;

// --------------------------------------------------------------------------
// Dérivation PURE des alertes (réutilise l'esprit de selectComplianceAlerts)
// --------------------------------------------------------------------------

/** Fenêtre (jours) de renouvellement anticipé pour les patients récurrents. */
export const RENEWAL_WINDOW_DAYS = 15;
/** Seuil d'alerte de consommation. */
export const PRESCRIPTION_THRESHOLD_RATIO = 0.8;

export interface PrescriptionAlertSource {
  id: string;
  patient_id: string;
  numero: string;
  trajets_autorises: number;
  trajets_consommes: number;
  date_expiration: string | null;
}

export type PrescriptionAlertKind = 'expiree' | 'epuisee' | 'renouvellement' | 'seuil_80';

export interface PrescriptionAlert {
  prescription_id: string;
  patient_id: string;
  numero: string;
  kind: PrescriptionAlertKind;
  trajets_restants: number;
}

function daysUntil(dateIso: string, today: Date): number {
  const target = new Date(`${dateIso}T00:00:00.000Z`).getTime();
  const base = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`).getTime();
  return Math.round((target - base) / 86_400_000);
}

/**
 * Dérive une alerte par prescription (la plus urgente). `expiree` > `epuisee` >
 * `renouvellement` > `seuil_80`. Une prescription sans alerte n'apparaît pas.
 *
 * RENOUVELLEMENT-01 (§5.3/§5.9) : l'alerte préventive `renouvellement`
 * (épuisement/expiration anticipé sous 15 j) est RÉSERVÉE aux bons liés à une
 * série récurrente (`seriesPrescriptionIds` = ids des bons rattachés à une
 * série active, via ride_recurrences.prescription_id). Un bon PONCTUEL proche
 * de l'épuisement reste couvert par `seuil_80`/`epuisee`/`expiree` — pas de
 * faux positif de renouvellement.
 */
export function derivePrescriptionAlerts(
  items: ReadonlyArray<PrescriptionAlertSource>,
  today: Date = new Date(),
  opts: { seriesPrescriptionIds?: ReadonlySet<string> } = {},
): PrescriptionAlert[] {
  const linkedToSeries = opts.seriesPrescriptionIds ?? new Set<string>();
  const out: PrescriptionAlert[] = [];

  for (const p of items) {
    const restants = Math.max(0, p.trajets_autorises - p.trajets_consommes);
    const ratio = p.trajets_autorises > 0 ? p.trajets_consommes / p.trajets_autorises : 1;
    const expired = p.date_expiration !== null && daysUntil(p.date_expiration, today) < 0;
    const expiresSoon =
      p.date_expiration !== null &&
      daysUntil(p.date_expiration, today) >= 0 &&
      daysUntil(p.date_expiration, today) <= RENEWAL_WINDOW_DAYS;
    const atThreshold = ratio >= PRESCRIPTION_THRESHOLD_RATIO;

    let kind: PrescriptionAlertKind | null = null;
    if (expired) kind = 'expiree';
    else if (p.trajets_consommes >= p.trajets_autorises) kind = 'epuisee';
    else if (linkedToSeries.has(p.id) && (atThreshold || expiresSoon)) kind = 'renouvellement';
    else if (atThreshold) kind = 'seuil_80';

    if (kind) {
      out.push({
        prescription_id: p.id,
        patient_id: p.patient_id,
        numero: p.numero,
        kind,
        trajets_restants: restants,
      });
    }
  }
  return out;
}
