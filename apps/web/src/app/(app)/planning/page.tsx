import { PageHeader } from '@/components/page-header';
import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { getPlanningData } from './_lib/planning-queries';
import { getPlanningValidation } from './_lib/validation-queries';
import { PlanningContent } from './_components/planning-content.client';
import { PlanningValidateBar } from './_components/planning-validate-bar.client';

export const metadata = { title: 'Planning' };
export const dynamic = 'force-dynamic';

/** Jour du planning : `?date=YYYY-MM-DD` (défaut : aujourd'hui, fuseau Réunion). */
function resolveDate(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Indian/Reunion' }).format(new Date());
}

/**
 * Planning des tournées (Module 5.12 lots A→D) — grille type Gantt : chauffeurs
 * × tranches horaires, courses du jour, code couleur + texte par statut,
 * filtres, zone « non affectées ». Réaffectation par glisser-déposer + clavier
 * (lot B), indicateurs de tournée (lot C), validation du planning J+1 avec gel
 * du prévu (lot D). Réservé aux rôles régulateur / dirigeant.
 *
 * Server Component : fetch unique (`getPlanningData` + statut de validation) ;
 * la grille cliente réutilise le socle Realtime du cockpit (`useCockpitRides`).
 */
export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}): Promise<JSX.Element> {
  await requireAdminOrRegulateurPage();
  const params = await searchParams;
  const date = resolveDate(params.date);
  const [data, validation] = await Promise.all([
    getPlanningData(date),
    getPlanningValidation(date),
  ]);

  return (
    <div className="space-y-16">
      <PageHeader
        title="Planning"
        description="Tournées du jour par chauffeur et tranche horaire."
      />
      <PlanningValidateBar date={date} validation={validation} />
      <PlanningContent
        date={data.date}
        initialRides={data.rides}
        meta={data.meta}
        drivers={data.drivers}
      />
    </div>
  );
}
