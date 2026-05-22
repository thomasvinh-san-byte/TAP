import Link from 'next/link';
import { Shield } from 'lucide-react';
import type { DashboardConformite } from '../_lib/queries-dashboard';

/**
 * Carte de statut de conformité du tableau de bord (Phase 06.8, D-10).
 *
 * Statut documentaire FACTUEL : compteurs des tables legal + dernière mise à
 * jour + lien vers l'espace Légal. Aucun verdict, aucun « conforme RGPD »,
 * aucun score, aucun état couleur — le RGPD impose de démontrer la conformité,
 * pas de la revendiquer (cohérent avec la non-certification de la Phase 06.6).
 * Composant présentationnel, server component.
 */

function formatDateFr(iso: string | null): string {
  if (!iso) return 'aucune';
  return new Date(iso).toLocaleDateString('fr-FR');
}

export function ComplianceCard({ conformite }: { conformite: DashboardConformite }): JSX.Element {
  const { registreCount, dpaCount, dpiaStatut, derniereMaj } = conformite;
  return (
    <section className="border-border bg-background flex flex-col gap-8 rounded-lg border p-16">
      <div className="flex items-center gap-8">
        <Shield className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <h3 className="text-sm font-medium">Conformité RGPD</h3>
      </div>
      <p className="text-sm">
        Registre : {registreCount} traitement{registreCount === 1 ? '' : 's'} · DPA : {dpaCount}{' '}
        fiche{dpaCount === 1 ? '' : 's'} · DPIA : {dpiaStatut}
      </p>
      <p className="text-muted-foreground text-xs">
        Dernière mise à jour : {formatDateFr(derniereMaj)}
      </p>
      <Link
        href="/admin/legal"
        className="text-primary focus-visible:ring-ring inline-flex min-h-[44px] items-center text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
      >
        Gérer →
      </Link>
    </section>
  );
}
