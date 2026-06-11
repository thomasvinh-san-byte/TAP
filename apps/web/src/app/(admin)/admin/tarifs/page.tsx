import { Receipt } from 'lucide-react';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/page-header';
import type { TariffGrid } from '@tap/pricing';
import { TariffGridCard } from './_components/tariff-grid-card.client';
import { TariffSimulator } from './_components/tariff-simulator.client';
import { TariffHistoryTable } from './_components/tariff-history-table.client';
import { getCachedTarifsPageData } from './_lib/cached-queries';

export const metadata = { title: 'Grille tarifaire' };
// DEC-153 (perf 08.04) : data-cache par organisation (cf. _lib/cached-queries.ts).
// Plus de force-dynamic — page dynamique (guard lit les cookies), donnée cachée
// par org et purgée à l'écriture (revalidateTag dans actions.ts).

export interface TariffGridRow extends TariffGrid {
  id: string;
  date_effet: string;
}

export default async function TarifsPage(): Promise<JSX.Element> {
  const ctx = await requireDirigeantPage();
  const grids = await getCachedTarifsPageData(ctx.organizationId);
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
