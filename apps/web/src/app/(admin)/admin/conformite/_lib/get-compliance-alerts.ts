import 'server-only';
import {
  selectComplianceAlerts,
  type ComplianceAlertSource,
  type ComplianceAlert,
} from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Charge la conformité d'une organisation et dérive les alertes
 * `soon`/`expired` triées par urgence (Phase 06.34, DEC-113).
 *
 * Source partagée cockpit (régulateur) + dashboard (dirigeant). 0
 * stockage, 0 cron : statut recalculé à la volée vs date du jour
 * (Q2 dérivé, RETEX secteur).
 *
 * RLS Postgres `compliance_items_select_same_org` fait le filtrage
 * organisation_id ; le client serveur transporte la session du
 * profil connecté. Joint le libellé entité (chauffeur/véhicule) côté
 * applicatif — pas de FK polymorphe SQL (cf. ADR-013).
 */

export type ComplianceAlertEnriched = ComplianceAlert & {
  /** Libellé prêt à afficher (nom chauffeur, immatriculation, « Organisation »). */
  entity_label: string;
};

export async function getComplianceAlerts(): Promise<ComplianceAlertEnriched[]> {
  const supabase = await createClient();

  const itemsRes = await supabase
    .from('compliance_items' as never)
    .select('id, entity_type, entity_id, kind, expires_at')
    .eq('archive', false);

  if (itemsRes.error) {
    console.error('[compliance-alerts] read error', {
      message: itemsRes.error.message,
      code: itemsRes.error.code,
    });
    return [];
  }

  const items = ((itemsRes.data ?? []) as ComplianceAlertSource[]) ?? [];
  const alerts = selectComplianceAlerts(items);
  if (alerts.length === 0) return [];

  // Hydrate labels en 2 lookups (drivers + vehicles) — petits volumes V1.
  const driverIds = Array.from(
    new Set(
      alerts.filter((a) => a.entity_type === 'driver' && a.entity_id).map((a) => a.entity_id!),
    ),
  );
  const vehicleIds = Array.from(
    new Set(
      alerts.filter((a) => a.entity_type === 'vehicle' && a.entity_id).map((a) => a.entity_id!),
    ),
  );

  const driverLabels: Record<string, string> = {};
  if (driverIds.length > 0) {
    const { data } = await supabase
      .from('drivers' as never)
      .select('id, nom_affichage')
      .in('id', driverIds);
    for (const d of (data as { id: string; nom_affichage: string }[] | null) ?? []) {
      driverLabels[d.id] = d.nom_affichage;
    }
  }
  const vehicleLabels: Record<string, string> = {};
  if (vehicleIds.length > 0) {
    const { data } = await supabase
      .from('vehicles' as never)
      .select('id, immatriculation, marque, modele')
      .in('id', vehicleIds);
    for (const v of (data as
      | { id: string; immatriculation: string; marque: string | null; modele: string | null }[]
      | null) ?? []) {
      const tail = [v.marque, v.modele].filter(Boolean).join(' ');
      vehicleLabels[v.id] = tail ? `${v.immatriculation} · ${tail}` : v.immatriculation;
    }
  }

  return alerts.map((a) => ({
    ...a,
    entity_label:
      a.entity_type === 'organization'
        ? 'Organisation'
        : a.entity_type === 'driver'
          ? (a.entity_id && driverLabels[a.entity_id]) || 'Chauffeur'
          : (a.entity_id && vehicleLabels[a.entity_id]) || 'Véhicule',
  }));
}
