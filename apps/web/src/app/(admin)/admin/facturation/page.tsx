import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import {
  getCoursesFacturables,
  getCountCoursesSansTarif,
  getChauffeursForSelector,
} from './_lib/queries-facturation';
import { PeriodeSelector } from './_components/periode-selector.client';
import { FactureApercu } from './_components/facture-apercu';

export const metadata = { title: 'Facturation CGSS' };
export const dynamic = 'force-dynamic';

/** Mois complet précédent, format `YYYY-MM` — défaut d'une facture mensuelle. */
function defaultMois(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default async function FacturationPage({
  searchParams,
}: {
  searchParams: { mois?: string; chauffeur?: string };
}): Promise<JSX.Element> {
  await requireDirigeantPage();

  const mois = /^\d{4}-\d{2}$/.test(searchParams.mois ?? '')
    ? (searchParams.mois as string)
    : defaultMois();
  const chauffeurId = searchParams.chauffeur || undefined;

  const [courses, countSansTarif, chauffeurs] = await Promise.all([
    getCoursesFacturables(mois, chauffeurId),
    getCountCoursesSansTarif(mois, chauffeurId),
    getChauffeursForSelector(),
  ]);

  return (
    <div className="space-y-24">
      <PageHeader
        title="Facturation CGSS"
        description="Récapitulatif mensuel des courses en tiers payant CGSS. Le PDF agrège les montants déjà calculés — tarif estimatif, non contractuel jusqu'à la facturation CGSS télétransmise."
      />

      <PeriodeSelector mois={mois} chauffeurId={chauffeurId} chauffeurs={chauffeurs} />

      <FactureApercu
        courses={courses}
        countSansTarif={countSansTarif}
        mois={mois}
        chauffeurId={chauffeurId}
      />
    </div>
  );
}
