import { COMPLIANCE_LABELS, type ComplianceKind, complianceStatus } from '@tap/shared';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import { ComplianceFieldset } from './_components/compliance-fieldset.client';

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
    <div className="space-y-24">
      <PageHeader
        title="Conformité réglementaire"
        description="Suivi des échéances cartes professionnelles, contrôles techniques, assurances et convention CGSS. Distinct du suivi RGPD documentaire."
      />

      <div className="grid gap-12 sm:grid-cols-3">
        <SummaryCard tone="text-destructive" label="Expirées" value={counts.expired} />
        <SummaryCard tone="text-warning" label="Proches de l’échéance" value={counts.soon} />
        <SummaryCard tone="text-muted-foreground" label="Total suivies" value={counts.total} />
      </div>

      <section className="space-y-16">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Convention CGSS (organisation)
        </h2>
        {orgRows.length === 0 ? (
          <ComplianceFieldset entityType="organization" entityId={null} initialItems={[]} />
        ) : (
          <ConformiteTable rows={orgRows} getLabel={() => 'Organisation'} />
        )}
      </section>

      <section className="space-y-16">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Chauffeurs
        </h2>
        {driverRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune échéance saisie. Renseignez-les depuis la fiche chauffeur (Modifier).
          </p>
        ) : (
          <ConformiteTable
            rows={driverRows}
            getLabel={(r) => (r.entity_id ? (driverLabels[r.entity_id] ?? '—') : '—')}
          />
        )}
      </section>

      <section className="space-y-16">
        <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
          Véhicules
        </h2>
        {vehicleRows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune échéance saisie. Renseignez-les depuis la fiche véhicule (Modifier).
          </p>
        ) : (
          <ConformiteTable
            rows={vehicleRows}
            getLabel={(r) => (r.entity_id ? (vehicleLabels[r.entity_id] ?? '—') : '—')}
          />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  tone,
  label,
  value,
}: {
  tone: string;
  label: string;
  value: number;
}): JSX.Element {
  return (
    <div className="border-border rounded-md border p-16">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className={`mt-4 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
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
