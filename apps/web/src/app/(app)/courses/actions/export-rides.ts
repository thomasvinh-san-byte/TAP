'use server';

/**
 * Server Action export CSV des courses (Phase 06.37 §5.23, DEC-116).
 *
 * Suit le pattern de `exportCaisseCsvAction` :
 *   - Zod schema → guard rôle requireAdminOrRegulateur → query
 *     RLS-scoppée organization_id (`createClient`) → `toCsv` →
 *     { csv, filename }.
 *
 * Sans nouvelle dépendance, sans réinventer de pricing. Colonnes :
 * date RDV, patient, départ, destination, mode, statut, chauffeur,
 * montant si disponible (tarif_amount_eur de `rides` — déjà calculé).
 *
 * NB §5.23 : ne contient PAS de données médicales (notes opérationnelles,
 * NIR). Champs strictement métier visibles en régulation. RGPD : la
 * minimisation est respectée.
 */

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { toCsv, escapeCsv, formatEurFr, formatDateFr } from '@/lib/csv';

const exportSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ attendu pour from.'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ attendu pour to.'),
    driverId: z.string().uuid().optional(),
    status: z
      .enum([
        'validee',
        'assignee',
        'en_cours',
        'terminee',
        'annulee_regulateur',
        'annulee_patient',
        'annulee_chauffeur',
        'annulee_meteo',
      ])
      .optional(),
    transportMode: z.enum(['taxi_conventionne', 'tpmr', 'vsl', 'ambulance']).optional(),
  })
  .refine((v) => v.from <= v.to, {
    message: 'La date de fin doit être postérieure ou égale à la date de début.',
    path: ['to'],
  });

export type ExportRidesInput = z.infer<typeof exportSchema>;

export interface ExportRidesResult {
  csv?: string;
  filename?: string;
  error?: string;
}

const STATUS_LABELS: Record<string, string> = {
  validee: 'Validée',
  assignee: 'Assignée',
  en_cours: 'En cours',
  arrive_sur_place: 'Arrivé sur place',
  patient_a_bord: 'Patient à bord',
  terminee: 'Terminée',
  annulee_regulateur: 'Annulée (régulateur)',
  annulee_patient: 'Annulée (patient)',
  annulee_chauffeur: 'Annulée (chauffeur)',
  annulee_meteo: 'Annulée (météo)',
};

const MODE_LABELS: Record<string, string> = {
  taxi_conventionne: 'Taxi conventionné',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

interface RawRideRow {
  id: string;
  scheduled_at: string;
  status: string;
  transport_mode: string;
  pickup_address: string | null;
  pickup_city: string | null;
  dropoff_address: string | null;
  dropoff_city: string | null;
  tarif_amount_eur: number | null;
  driver_id: string | null;
  patient_id: string;
}

export async function exportRidesCsvAction(input: ExportRidesInput): Promise<ExportRidesResult> {
  const parsed = exportSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Filtres invalides.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

  const supabase = await createClient();
  const fromIso = `${parsed.data.from}T00:00:00.000Z`;
  const toIso = `${parsed.data.to}T23:59:59.999Z`;

  let q = supabase
    .from('rides')
    .select(
      'id, scheduled_at, status, transport_mode, ' +
        'pickup_address, pickup_city, dropoff_address, dropoff_city, ' +
        'tarif_amount_eur, driver_id, patient_id',
    )
    .gte('scheduled_at', fromIso)
    .lte('scheduled_at', toIso)
    .eq('archive', false)
    .order('scheduled_at', { ascending: true })
    .limit(5000);
  if (parsed.data.driverId) q = q.eq('driver_id', parsed.data.driverId);
  if (parsed.data.status) q = q.eq('status', parsed.data.status);
  if (parsed.data.transportMode) q = q.eq('transport_mode', parsed.data.transportMode);

  const { data, error } = await q;
  if (error) return { error: 'Lecture des courses impossible.' };
  const rides = ((data ?? []) as RawRideRow[]) ?? [];

  // Hydrate patient + driver labels en 2 lookups (pas de FK polymorphe :
  // patients_safe = vue sans ciphertext, drivers = nom_affichage).
  const patientIds = Array.from(new Set(rides.map((r) => r.patient_id)));
  const driverIds = Array.from(
    new Set(rides.map((r) => r.driver_id).filter((v): v is string => !!v)),
  );
  const patientLabels: Record<string, string> = {};
  if (patientIds.length > 0) {
    const { data: p } = await supabase
      .from('patients_safe')
      .select('id, nom, prenom')
      .in('id', patientIds);
    for (const row of (p as { id: string; nom: string; prenom: string }[] | null) ?? []) {
      patientLabels[row.id] = `${row.nom} ${row.prenom}`.trim();
    }
  }
  const driverLabels: Record<string, string> = {};
  if (driverIds.length > 0) {
    const { data: d } = await supabase
      .from('drivers')
      .select('id, nom_affichage')
      .in('id', driverIds);
    for (const row of (d as { id: string; nom_affichage: string }[] | null) ?? []) {
      driverLabels[row.id] = row.nom_affichage;
    }
  }

  function trajet(addr: string | null, city: string | null): string {
    if (city && addr) return `${addr}, ${city}`;
    return addr ?? city ?? '';
  }

  const csv = toCsv(
    [
      'Date RDV',
      'Patient',
      'Départ',
      'Destination',
      'Mode transport',
      'Statut',
      'Chauffeur',
      'Tarif (€)',
    ],
    rides.map((r) => [
      formatDateFr(r.scheduled_at),
      patientLabels[r.patient_id] ?? '',
      trajet(r.pickup_address, r.pickup_city),
      trajet(r.dropoff_address, r.dropoff_city),
      MODE_LABELS[r.transport_mode] ?? r.transport_mode,
      STATUS_LABELS[r.status] ?? r.status,
      r.driver_id ? (driverLabels[r.driver_id] ?? '') : '',
      r.tarif_amount_eur !== null ? formatEurFr(Number(r.tarif_amount_eur)) : '',
    ]),
  );

  // `escapeCsv` non utilisé directement ici (toCsv s'en charge) mais
  // importé pour signalement explicite de la protection injection formula.
  void escapeCsv;

  const filename = `courses_${parsed.data.from}_${parsed.data.to}.csv`;
  return { csv, filename };
}
