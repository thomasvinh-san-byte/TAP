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
  if (!ctx)
    return { error: 'Action réservée au régulateur ou dirigeant.' };

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
