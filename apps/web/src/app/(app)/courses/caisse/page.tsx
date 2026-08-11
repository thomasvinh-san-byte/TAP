import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { PageHeader } from '@/components/page-header';
import { listActiveDriversAction } from '../actions';
import {
  listRidesEncaissees,
  listRidesAEncaisser,
  type CaisseFilters,
  type CaisseSortColumn,
  type CaisseSortDir,
  type CaissePaymentMethod,
} from './_lib/queries-caisse';
import { CaisseSummary } from './_components/caisse-summary.client';
import { CaisseCloture } from './_components/caisse-cloture.client';
import { CaisseTable } from './_components/caisse-table.client';
import { CaisseTableAEncaisser } from './_components/caisse-table-a-encaisser.client';
import { CaisseToolbar, type CaisseVue } from './_components/caisse-toolbar.client';

export const metadata = { title: 'Caisse' };

interface PageProps {
  searchParams: Promise<{
    vue?: string;
    date?: string;
    driver_id?: string;
    payment_method?: string;
    sort?: string;
    dir?: string;
  }>;
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const VALID_SORTS: CaisseSortColumn[] = ['date', 'tarif'];
const VALID_DIRS: CaisseSortDir[] = ['asc', 'desc'];
const VALID_METHODS: CaissePaymentMethod[] = ['cash', 'cb', 'cheque', 'cgss_differe'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function CaissePage(props: PageProps) {
  const searchParams = await props.searchParams;
  await requireAdminOrRegulateurPage();
  const vue: CaisseVue = searchParams.vue === 'a_encaisser' ? 'a_encaisser' : 'encaissees';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '')
    ? (searchParams.date as string)
    : todayIso();
  const sort: CaisseSortColumn = VALID_SORTS.includes(searchParams.sort as CaisseSortColumn)
    ? (searchParams.sort as CaisseSortColumn)
    : 'date';
  const dir: CaisseSortDir = VALID_DIRS.includes(searchParams.dir as CaisseSortDir)
    ? (searchParams.dir as CaisseSortDir)
    : 'desc';
  const paymentMethod = VALID_METHODS.includes(searchParams.payment_method as CaissePaymentMethod)
    ? (searchParams.payment_method as CaissePaymentMethod)
    : undefined;

  const filters: CaisseFilters = {
    date,
    driverId: searchParams.driver_id,
    paymentMethod,
    sort,
    dir,
  };

  const drivers = await listActiveDriversAction();

  if (vue === 'a_encaisser') {
    const { rows, total_eur, count } = await listRidesAEncaisser({
      driverId: searchParams.driver_id,
    });
    return (
      <div className="max-w-[1280px] space-y-24">
        <PageHeader
          title="Caisse"
          description="Courses terminées restant à encaisser. Plus anciennes d'abord."
        />
        <CaisseToolbar vue={vue} date={date} drivers={drivers} filters={filters} />
        <div className="border-border bg-muted/20 flex items-baseline gap-12 rounded-md border p-16">
          <span className="text-2xl font-semibold tabular-nums">{eur.format(total_eur)}</span>
          <span className="text-muted-foreground text-sm tabular-nums">
            à encaisser · {count} course{count > 1 ? 's' : ''}
          </span>
        </div>
        <CaisseTableAEncaisser rows={rows} />
      </div>
    );
  }

  const { rows, totals } = await listRidesEncaissees(filters);

  return (
    <div className="max-w-[1280px] space-y-24">
      <PageHeader
        title="Caisse"
        description="Encaissements de la journée. Total et détail par course."
      />
      <CaisseToolbar vue={vue} date={date} drivers={drivers} filters={filters} />
      <CaisseSummary totals={totals} />
      <CaisseTable rows={rows} sort={sort} dir={dir} date={date} />
      <CaisseCloture byMethod={totals.by_method} />
    </div>
  );
}
