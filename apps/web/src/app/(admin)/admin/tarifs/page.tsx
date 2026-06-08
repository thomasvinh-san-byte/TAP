import { Receipt } from 'lucide-react';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/page-header';
import type { TariffGrid } from '@tap/pricing';
import { TariffGridCard } from './_components/tariff-grid-card.client';
import { TariffSimulator } from './_components/tariff-simulator.client';
import { TariffHistoryTable } from './_components/tariff-history-table.client';

export const metadata = { title: 'Grille tarifaire' };
export const dynamic = 'force-dynamic';

export interface TariffGridRow extends TariffGrid {
  id: string;
  date_effet: string;
}

export default async function TarifsPage(): Promise<JSX.Element> {
  await requireDirigeantPage();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tariff_grids')
    .select(
      'id, date_effet, forfait_eur, km_inclus, prix_km_eur, ' +
        'supplement_drom_eur, supplement_tpmr_eur, majoration_pct, ' +
        'facteur_correction_routier, arrondi_eur',
    )
    .order('date_effet', { ascending: false });
  if (error) {
    console.error('[admin/tarifs] Erreur Supabase:', error);
  }
  const grids = (data as TariffGridRow[] | null) ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const activeGrid = grids.find((g) => g.date_effet <= today) ?? null;

  return (
    <div className="space-y-24">
      <PageHeader
        title="Grille tarifaire CGSS"
        description="Convention-cadre nationale CNAM applicable 2026. Toute modification crée une nouvelle version datée. L'historique est conservé."
      />

      {activeGrid === null ? (
        <EmptyState
          icon={Receipt}
          title="Aucune grille tarifaire active"
          description="Définissez votre grille tarifaire CGSS pour commencer à facturer."
        />
      ) : (
        <>
          <div className="grid gap-16 lg:grid-cols-2">
            <TariffGridCard grid={activeGrid} />
            <TariffSimulator grid={activeGrid} />
          </div>
          <TariffHistoryTable grids={grids} activeId={activeGrid.id} />
        </>
      )}
    </div>
  );
}
