'use server';

/**
 * Server Action export CSV caisse (Phase 04.7 PLAN-2 T2.1).
 *
 * Retourne le CSV en string + filename pour téléchargement client-side
 * (pattern courant Next.js Server Actions — pas de streaming Response
 * V1.5, suffisant pour ≤ 50 rides/jour).
 *
 * Refs : DEC-043 LOCKED (permissions), T-04.7-08 (formula injection
 * mitigée via escapeCsv).
 */

import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import {
  listRidesEncaissees,
  getCaisseReportByDriver,
  CAISSE_REPORT_METHODS,
  type CaisseFilters,
} from '../caisse/_lib/queries-caisse';
import { toCsv, formatEurFr, formatDateFr } from '@/lib/csv';

const exportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverId: z.string().uuid().optional(),
  paymentMethod: z.enum(['cash', 'cb', 'cheque', 'cgss_differe']).optional(),
});

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  cb: 'CB',
  cheque: 'Chèque',
  cgss_differe: 'CGSS différé',
};

export interface ExportCaisseResult {
  csv?: string;
  filename?: string;
  error?: string;
}

export async function exportCaisseCsvAction(
  input: z.infer<typeof exportSchema>,
): Promise<ExportCaisseResult> {
  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) return { error: 'Filtres invalides.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

  const filters: CaisseFilters = {
    date: parsed.data.date,
    driverId: parsed.data.driverId,
    paymentMethod: parsed.data.paymentMethod,
  };
  const { rows } = await listRidesEncaissees(filters);

  const csv = toCsv(
    ['Date', 'Patient', 'Chauffeur', 'Mode paiement', 'Tarif (€)'],
    rows.map((r) => [
      formatDateFr(r.ended_at ?? r.scheduled_at),
      `${r.patient_nom} ${r.patient_prenom}`.trim(),
      r.driver_nom,
      PAYMENT_LABELS[r.payment_method ?? ''] ?? '',
      formatEurFr(Number(r.tarif_amount_eur ?? 0)),
    ]),
  );

  return { csv, filename: `caisse-${parsed.data.date}.csv` };
}

// CAISSE-02 — rapport de caisse agrégé PAR CHAUFFEUR sur une période (CdG §5.19).
const MAX_REPORT_DAYS = 366; // garde-fou plage ≤ ~12 mois (perf).

const reportSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de début invalide (AAAA-MM-JJ).'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de fin invalide (AAAA-MM-JJ).'),
    driverId: z.string().uuid().optional(),
  })
  .refine((v) => v.from <= v.to, {
    message: 'La date de fin doit être postérieure ou égale à la date de début.',
    path: ['to'],
  })
  .refine(
    (v) => (new Date(v.to).getTime() - new Date(v.from).getTime()) / 86_400_000 <= MAX_REPORT_DAYS,
    { message: 'Plage trop large (12 mois maximum).', path: ['to'] },
  );

const METHOD_HEADERS: Record<(typeof CAISSE_REPORT_METHODS)[number], string> = {
  cash: 'Espèces (€)',
  cb: 'CB (€)',
  cheque: 'Chèque (€)',
  cgss_differe: 'CGSS différé (€)',
};

/**
 * Export CSV du rapport de caisse par chauffeur (CAISSE-02) : une ligne par
 * chauffeur (nb courses + ventilation par mode + total), puis une ligne « Total »
 * générale. Agrégation déléguée à `getCaisseReportByDriver`.
 */
export async function exportCaisseReportByDriverCsvAction(
  input: z.infer<typeof reportSchema>,
): Promise<ExportCaisseResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Filtres invalides.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

  const report = await getCaisseReportByDriver(
    parsed.data.from,
    parsed.data.to,
    parsed.data.driverId,
  );

  const headers = [
    'Chauffeur',
    'Nb courses',
    ...CAISSE_REPORT_METHODS.map((m) => METHOD_HEADERS[m]),
    'Total (€)',
  ];
  const bodyRows = report.rows.map((r) => [
    r.driver_nom,
    String(r.count),
    ...CAISSE_REPORT_METHODS.map((m) => formatEurFr(r.by_method[m] ?? 0)),
    formatEurFr(r.total_eur),
  ]);
  const totalRow = [
    'Total',
    String(report.total.count),
    ...CAISSE_REPORT_METHODS.map((m) => formatEurFr(report.total.by_method[m] ?? 0)),
    formatEurFr(report.total.total_eur),
  ];

  const csv = toCsv(headers, [...bodyRows, totalRow]);
  return { csv, filename: `rapport-caisse-${parsed.data.from}_${parsed.data.to}.csv` };
}
