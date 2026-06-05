import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { listActiveDriversAction } from '../actions';
import {
  listRidesEncaissees,
  type CaisseFilters,
  type CaisseSortColumn,
  type CaisseSortDir,
  type CaissePaymentMethod,
} from './_lib/queries-caisse';
import { CaisseSummary } from './_components/caisse-summary.client';
import { CaisseTable } from './_components/caisse-table.client';
import { CaisseToolbar } from './_components/caisse-toolbar.client';

export const metadata = { title: 'Caisse' };

interface PageProps {
  searchParams: Promise<{
    date?: string;
    driver_id?: string;
    payment_method?: string;
    sort?: string;
    dir?: string;
  }>;
}

const VALID_SORTS: CaisseSortColumn[] = ['date', 'tarif'];
const VALID_DIRS: CaisseSortDir[] = ['asc', 'desc'];
const VALID_METHODS: CaissePaymentMethod[] = ['cash', 'cb', 'cheque', 'cgss_differe'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function CaissePage(props: PageProps) {
  const searchParams = await props.searchParams;
  await requireAdminOrRegulateurPage();
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

  const [{ rows, totals }, drivers] = await Promise.all([
    listRidesEncaissees(filters),
    listActiveDriversAction(),
  ]);

  return (
    <div className="max-w-[1280px] space-y-24">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Caisse</h1>
        <p className="text-muted-foreground text-sm">
          Encaissements de la journée. Total et détail par course.
        </p>
      </header>
      <CaisseToolbar date={date} drivers={drivers} filters={filters} />
      <CaisseSummary totals={totals} />
      <CaisseTable rows={rows} sort={sort} dir={dir} date={date} />
    </div>
  );
}
