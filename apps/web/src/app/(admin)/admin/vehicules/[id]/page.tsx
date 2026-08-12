import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { COMPLIANCE_LABELS } from '@tap/shared';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import {
  getVehicleDetail,
  getVehicleRecentRides,
  type VehicleComplianceItem,
} from '../_lib/vehicle-detail';
import type { VehicleRow } from '../page';
import { StatusBadge } from '../../../../(app)/courses/_components/ride-badges';
import { VehicleEditButton } from './_components/vehicle-edit-button.client';

export const metadata = { title: 'Fiche véhicule' };

const TYPE_LABELS: Record<VehicleRow['type'], string> = {
  taxi_conventionne: 'Taxi conventionné',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

/** JJ/MM/AAAA sans construire de `Date` (évite tout décalage de fuseau). */
function formatDay(iso: string | null): string {
  return iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—';
}

/** Tuile bento — même langage que la fiche patient et le cockpit. */
function BentoTile({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={cn('bg-background border-border rounded-lg border p-16', className)}>
      {children}
    </div>
  );
}

function EquipRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-12">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ComplianceLine({ item }: { item: VehicleComplianceItem }): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-12 py-8">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{COMPLIANCE_LABELS[item.kind] ?? item.kind}</p>
        <p className="text-muted-foreground text-xs tabular-nums">
          Échéance : {formatDay(item.expires_at)}
        </p>
      </div>
      <ComplianceBadge expiresAt={item.expires_at} className="shrink-0" />
    </li>
  );
}

export default async function VehiculeDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  await requireDirigeantPage();
  const data = await getVehicleDetail(id);
  if (!data) notFound();
  const { vehicle, compliance } = data;
  const recentRides = await getVehicleRecentRides(id);
  const uploadEnabled = process.env.UPLOAD_DOCS_ENABLED === 'true';

  const statut = vehicle.archive
    ? { label: 'Archivé', variant: 'outline' as const }
    : vehicle.actif
      ? { label: 'Actif', variant: 'default' as const }
      : { label: 'Inactif', variant: 'outline' as const };

  return (
    <div className="space-y-16">
      {/* BANDEAU D'IDENTIFICATION — identifiants du véhicule sans ambiguïté
          (immatriculation en avant, marque/modèle, type, statut) + Modifier. */}
      <header
        aria-label={`Identification du véhicule ${vehicle.immatriculation}`}
        className="bg-background border-border flex flex-wrap items-start justify-between gap-16 rounded-lg border p-16"
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold uppercase tabular-nums tracking-tight">
            {vehicle.immatriculation}
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-x-12 gap-y-8 text-sm">
            <span className="text-foreground font-medium">
              {[vehicle.marque, vehicle.modele].filter(Boolean).join(' ') ||
                'Marque/modèle non renseigné'}
            </span>
            <Badge variant="secondary" className="text-xs">
              {TYPE_LABELS[vehicle.type]}
            </Badge>
            <Badge variant={statut.variant} className="text-xs">
              {statut.label}
            </Badge>
          </div>
        </div>
        <VehicleEditButton vehicle={vehicle} uploadEnabled={uploadEnabled} />
      </header>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2 lg:grid-cols-12">
        {/* Important — Échéances / conformité (enjeu réglementaire). */}
        <BentoTile className="lg:col-span-6 lg:min-h-[240px]">
          <section className="space-y-8" aria-labelledby="vehicule-conformite">
            <div className="flex items-center justify-between gap-8">
              <h2 id="vehicule-conformite" className="text-base font-semibold">
                Échéances de conformité
              </h2>
              <Link
                href="/admin/conformite"
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex shrink-0 items-center gap-4 rounded-md text-xs font-medium focus:outline-none focus-visible:ring-2"
              >
                Gérer
                <ArrowUpRight className="h-12 w-12" aria-hidden />
              </Link>
            </div>
            {compliance.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucune échéance enregistrée (contrôle technique, assurance…). Renseignez-les depuis
                la page Conformité.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {compliance.map((item) => (
                  <ComplianceLine key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
        </BentoTile>

        {/* Important — Équipements & capacité (compatibilité besoins patients). */}
        <BentoTile className="lg:col-span-6 lg:min-h-[240px]">
          <section className="space-y-8" aria-labelledby="vehicule-equipements">
            <h2 id="vehicule-equipements" className="text-base font-semibold">
              Équipements &amp; capacité
            </h2>
            <div className="space-y-8">
              <EquipRow label="Type" value={TYPE_LABELS[vehicle.type]} />
              <EquipRow
                label="Places assises"
                value={vehicle.places_assises !== null ? vehicle.places_assises : '—'}
              />
              <EquipRow
                label="Places TPMR"
                value={vehicle.places_tpmr !== null ? vehicle.places_tpmr : '—'}
              />
              <EquipRow label="Oxygène" value={vehicle.equipement_oxygene ? 'Oui' : 'Non'} />
              <EquipRow label="Brancard" value={vehicle.equipement_brancard ? 'Oui' : 'Non'} />
              <EquipRow
                label="Capacité de charge"
                value={
                  vehicle.capacite_charge_kg !== null ? `${vehicle.capacite_charge_kg} kg` : '—'
                }
              />
              {vehicle.equipement_autre && (
                <EquipRow label="Autre" value={vehicle.equipement_autre} />
              )}
            </div>
          </section>
        </BentoTile>

        {/* En appui — Utilisation (courses récentes rattachées au véhicule). */}
        <BentoTile className="lg:col-span-12">
          <section className="space-y-8" aria-labelledby="vehicule-utilisation">
            <h2 id="vehicule-utilisation" className="text-base font-semibold">
              Utilisation récente
            </h2>
            {recentRides.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Aucune course rattachée à ce véhicule pour l&apos;instant.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {recentRides.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-12 py-8">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {`${r.patient_nom} ${r.patient_prenom}`.trim() || 'Patient inconnu'}
                        {r.dropoff_address ? (
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            → {r.dropoff_address.split(',')[0]}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-muted-foreground text-xs tabular-nums">
                        {new Date(r.scheduled_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </BentoTile>
      </div>

      <p className="text-muted-foreground text-sm">
        <Link href="/admin/vehicules" className="hover:text-foreground underline">
          ← Retour à la liste des véhicules
        </Link>
      </p>
    </div>
  );
}
