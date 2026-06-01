import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { createClient } from '@/lib/supabase/server';
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
  const supabase = createClient();
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
      <header className="space-y-8">
        <h1 className="text-2xl font-semibold tracking-tight">Grille tarifaire CGSS</h1>
        <p className="text-muted-foreground text-sm">
          Convention-cadre nationale CNAM applicable 2026. Toute modification crée une nouvelle
          version datée — l&apos;historique est conservé.
        </p>
      </header>

      {activeGrid === null ? (
        <p className="border-border bg-muted/20 text-muted-foreground rounded-md border border-dashed p-16 text-sm">
          Aucune grille tarifaire configurée.
        </p>
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
