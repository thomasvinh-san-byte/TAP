import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import { createClient } from '@/lib/supabase/server';
import { CostParametersForm } from './_components/cost-parameters-form.client';

export const metadata = { title: 'Paramètres de coût' };
export const dynamic = 'force-dynamic';

/**
 * Paramètres de coût de l'organisation (§5.20 lot E) — dirigeant. Coûts €/km
 * (carburant + entretien + amortissement) utilisés pour estimer la marge dans
 * le tableau de bord. Sans ces paramètres, les KPIs de marge s'affichent « non
 * configuré » (jamais un zéro trompeur).
 */
export default async function ParametresCoutsPage(): Promise<JSX.Element> {
  await requireDirigeantPage();
  const supabase = await createClient();
  const { data } = await supabase
    .from('cost_parameters')
    .select('cout_carburant_eur_km, cout_entretien_eur_km, cout_amortissement_eur_km')
    .maybeSingle();

  const initial = data
    ? {
        cout_carburant_eur_km: Number(
          (data as { cout_carburant_eur_km: number }).cout_carburant_eur_km,
        ),
        cout_entretien_eur_km: Number(
          (data as { cout_entretien_eur_km: number }).cout_entretien_eur_km,
        ),
        cout_amortissement_eur_km: Number(
          (data as { cout_amortissement_eur_km: number }).cout_amortissement_eur_km,
        ),
      }
    : null;

  return (
    <div className="max-w-[720px] space-y-24">
      <PageHeader
        title="Paramètres de coût"
        description="Coûts kilométriques de l'organisation, utilisés pour estimer la marge dans le tableau de bord. Réservé au dirigeant."
      />
      <section className="border-border space-y-16 rounded-md border p-16">
        <CostParametersForm initial={initial} />
      </section>
    </div>
  );
}
