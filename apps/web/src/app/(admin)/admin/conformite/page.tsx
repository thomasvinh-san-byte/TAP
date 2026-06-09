import { COMPLIANCE_LABELS, type ComplianceKind, complianceStatus } from '@tap/shared';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import { KpiCard } from '@/app/(app)/tableau-de-bord/_components/kpi-card';
import { ComplianceFieldset } from './_components/compliance-fieldset.client';
import { BlockingModeControl } from './_components/blocking-mode-control.client';
import { getComplianceBlockingMode } from './_lib/compliance-planning';

export const metadata = { title: 'Conformité réglementaire' };
export const dynamic = 'force-dynamic';

/**
 * Page admin Conformité réglementaire (CdC §5.21, Phase 06.33, DEC-112).
 *
 * Lot 1 : vue d'ensemble par entité + section convention CGSS organisation.
 * Les alertes (cron + cockpit) et le blocage planification sont les lots
 * 2 et 3 respectivement. Distincte du sous-domaine `/admin/legal/*` qui
 * couvre la conformité RGPD documentaire (registre/DPA/DPIA).
 */

interface RawRow {
  id: string;
  entity_type: 'driver' | 'vehicle' | 'organization';
  entity_id: string | null;
  kind: ComplianceKind;
  reference: string | null;
  expires_at: string | null;
  driver_label?: string | null;
  vehicle_label?: string | null;
}

export default async function ConformitePage() {
  await requireDirigeantPage();
  const supabase = await createClient();
  const blockingMode = await getComplianceBlockingMode();

  const itemsRes = await supabase
    .from('compliance_items' as never)
    .select('id, entity_type, entity_id, kind, reference, expires_at')
    .eq('archive', false)
    .order('expires_at', { ascending: true, nullsFirst: false });

  const rows = ((itemsRes.data ?? []) as RawRow[]) ?? [];

  // Joindre labels chauffeur/véhicule (mini join client — petits volumes
  // V1, pas de relation Supabase configurée).
  const driverIds = Array.from(
    new Set(rows.filter((r) => r.entity_type === 'driver' && r.entity_id).map((r) => r.entity_id!)),
  );
  const vehicleIds = Array.from(
    new Set(
      rows.filter((r) => r.entity_type === 'vehicle' && r.entity_id).map((r) => r.entity_id!),
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
      vehicleLabels[v.id] =
        `${v.immatriculation}${v.marque ? ` · ${v.marque}` : ''}${v.modele ? ` ${v.modele}` : ''}`;
    }
  }

  const driverRows = rows.filter((r) => r.entity_type === 'driver');
  const vehicleRows = rows.filter((r) => r.entity_type === 'vehicle');
  const orgRows = rows.filter((r) => r.entity_type === 'organization');

  const counts = {
    expired: rows.filter((r) => complianceStatus(r.expires_at).status === 'expired').length,
    soon: rows.filter((r) => complianceStatus(r.expires_at).status === 'soon').length,
    total: rows.length,
  };

  return (
    <div className="space-y-16">
      <PageHeader
        title="Conformité réglementaire"
        description="Suivi des échéances cartes professionnelles, contrôles techniques, assurances et convention CGSS. Distinct du suivi RGPD documentaire."
      />

      {/* Résumé via KpiCard partagée (cohérence dashboard, DEC-128/129). */}
      <div className="grid items-stretch gap-12 sm:grid-cols-3">
        <KpiCard
          variant="simple"
          label="Expirées"
          value={String(counts.expired)}
          state={counts.expired > 0 ? 'alerte' : 'neutre'}
        />
        <KpiCard
          variant="simple"
          label="Proches de l'échéance"
          value={String(counts.soon)}
          state={counts.soon > 0 ? 'attention' : 'neutre'}
        />
        <KpiCard variant="simple" label="Total suivies" value={String(counts.total)} />
      </div>

      {/* Réglage Avertir/Bloquer — compact (une ligne, D-02). */}
      <BlockingModeControl initialMode={blockingMode} />

      {/* Convention CGSS (organisation) — pleine largeur. */}
      <section className="space-y-8">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Convention CGSS (organisation)
        </h2>
        {orgRows.length === 0 ? (
          <ComplianceFieldset entityType="organization" entityId={null} initialItems={[]} />
        ) : (
          <ConformiteTable rows={orgRows} getLabel={() => 'Organisation'} />
        )}
      </section>

      {/* Chauffeurs + Véhicules côte à côte (D-03). */}
      <div className="grid items-stretch gap-12 lg:grid-cols-2">
        <section className="space-y-8">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Chauffeurs
          </h2>
          {driverRows.length === 0 ? (
            <EmptyEntity
              message="Aucune échéance saisie — à renseigner depuis la fiche chauffeur."
              href="/admin/chauffeurs"
              linkLabel="Fiches chauffeurs"
            />
          ) : (
            <ConformiteTable
              rows={driverRows}
              getLabel={(r) => (r.entity_id ? (driverLabels[r.entity_id] ?? '—') : '—')}
            />
          )}
        </section>

        <section className="space-y-8">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            Véhicules
          </h2>
          {vehicleRows.length === 0 ? (
            <EmptyEntity
              message="Aucune échéance saisie — à renseigner depuis la fiche véhicule."
              href="/admin/vehicules"
              linkLabel="Fiches véhicules"
            />
          ) : (
            <ConformiteTable
              rows={vehicleRows}
              getLabel={(r) => (r.entity_id ? (vehicleLabels[r.entity_id] ?? '—') : '—')}
            />
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * État vide discret (D-03) : une ligne bordée muted + lien vers les fiches,
 * pas une section pleine. Évite le vide structurel.
 */
function EmptyEntity({
  message,
  href,
  linkLabel,
}: {
  message: string;
  href: string;
  linkLabel: string;
}): JSX.Element {
  return (
    <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-8 rounded-md border p-16 text-sm">
      <span>{message}</span>
      <Link
        href={href}
        className="text-primary focus-visible:outline-ring shrink-0 rounded-sm font-medium hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {linkLabel} →
      </Link>
    </div>
  );
}

function ConformiteTable({
  rows,
  getLabel,
}: {
  rows: RawRow[];
  getLabel: (r: RawRow) => string;
}): JSX.Element {
  return (
    <div className="border-border overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-12 py-8 text-left font-medium">Entité</th>
            <th className="px-12 py-8 text-left font-medium">Type</th>
            <th className="px-12 py-8 text-left font-medium">Référence</th>
            <th className="px-12 py-8 text-left font-medium">Échéance</th>
            <th className="px-12 py-8 text-left font-medium">État</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-border border-t">
              <td className="px-12 py-8">{getLabel(r)}</td>
              <td className="px-12 py-8">{COMPLIANCE_LABELS[r.kind]}</td>
              <td className="text-muted-foreground px-12 py-8">{r.reference ?? '—'}</td>
              <td className="px-12 py-8 tabular-nums">
                {r.expires_at
                  ? new Date(`${r.expires_at}T00:00:00`).toLocaleDateString('fr-FR')
                  : '—'}
              </td>
              <td className="px-12 py-8">
                <ComplianceBadge expiresAt={r.expires_at} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
