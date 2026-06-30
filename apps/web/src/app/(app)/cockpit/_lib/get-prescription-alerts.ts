import 'server-only';
import {
  derivePrescriptionAlerts,
  type PrescriptionAlert,
  type PrescriptionAlertSource,
} from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Alertes prescriptions de l'org (CdG §5.3, DEC-163) — dérivées à la volée
 * (0 stockage, 0 cron, comme get-compliance-alerts) : seuil 80 % / épuisée /
 * expirée / renouvellement (patients récurrents). RLS Postgres scope l'org.
 * try/catch + fallback `[]` gracieux (table récente, ne casse jamais le cockpit).
 */
export type PrescriptionAlertEnriched = PrescriptionAlert & { patient_label: string };

export async function getPrescriptionAlerts(): Promise<PrescriptionAlertEnriched[]> {
  try {
    const supabase = await createClient();
    const res = await supabase
      .from('prescriptions')
      .select('id, patient_id, numero, trajets_autorises, trajets_consommes, date_expiration');
    if (res.error) {
      console.error('[prescription-alerts] read error', res.error.message);
      return [];
    }
    const items = (res.data as PrescriptionAlertSource[] | null) ?? [];
    if (items.length === 0) return [];

    // RENOUVELLEMENT-01 : bons liés à une série ACTIVE (via la FK
    // ride_recurrences.prescription_id). L'alerte de renouvellement anticipé est
    // réservée à ces bons — un bon ponctuel ne déclenche pas de faux positif.
    const recRes = await supabase
      .from('ride_recurrences')
      .select('prescription_id')
      .is('archived_at', null)
      .not('prescription_id', 'is', null);
    const seriesPrescriptionIds = new Set(
      ((recRes.data as { prescription_id: string | null }[] | null) ?? [])
        .map((r) => r.prescription_id)
        .filter((id): id is string => Boolean(id)),
    );

    const alerts = derivePrescriptionAlerts(items, new Date(), { seriesPrescriptionIds });
    if (alerts.length === 0) return [];

    const patientIds = Array.from(new Set(alerts.map((a) => a.patient_id)));
    const labels = new Map<string, string>();
    const { data } = await supabase
      .from('patients_safe')
      .select('id, nom, prenom')
      .in('id', patientIds);
    for (const p of (data as { id: string; nom: string; prenom: string }[] | null) ?? []) {
      labels.set(p.id, `${p.nom} ${p.prenom}`.trim());
    }

    return alerts.map((a) => ({ ...a, patient_label: labels.get(a.patient_id) ?? 'Patient' }));
  } catch {
    return [];
  }
}
