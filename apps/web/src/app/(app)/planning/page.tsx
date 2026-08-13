import { PageHeader } from '@/components/page-header';
import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { getPlanningData } from './_lib/planning-queries';
import { PlanningContent } from './_components/planning-content.client';

export const metadata = { title: 'Planning' };
export const dynamic = 'force-dynamic';

/** Jour du planning : `?date=YYYY-MM-DD` (défaut : aujourd'hui, fuseau Réunion). */
function resolveDate(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Indian/Reunion' }).format(new Date());
}

/**
 * Planning des tournées (Module 5.12 lot A) — grille type Gantt en LECTURE
 * SEULE : chauffeurs × tranches horaires, courses du jour positionnées, code
 * couleur + texte par statut, filtres, zone « non affectées ». Réservé aux
 * rôles régulateur / dirigeant. Aucune écriture à ce lot (drag-drop = lot B).
 *
 * Server Component : point de fetch unique (`getPlanningData`) ; la grille
 * cliente réutilise le socle Realtime du cockpit (`useCockpitRides`).
 */
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}): Promise<JSX.Element> {
  await requireAdminOrRegulateurPage();
  const params = await searchParams;
  const date = resolveDate(params.date);
  const data = await getPlanningData(date);

  return (
    <div className="space-y-16">
      <PageHeader
        title="Planning"
        description="Tournées du jour par chauffeur et tranche horaire. Vue de consultation."
      />
      <PlanningContent
        date={data.date}
        initialRides={data.rides}
        meta={data.meta}
        drivers={data.drivers}
      />
    </div>
  );
}
