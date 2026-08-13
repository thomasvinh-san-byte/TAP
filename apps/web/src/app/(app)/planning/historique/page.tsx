import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { getPlanningHistorique } from '../_lib/historique-queries';
import { HistoriqueView } from '../_components/historique-view';

export const metadata = { title: 'Historique planning' };
export const dynamic = 'force-dynamic';

function resolveDate(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Indian/Reunion' }).format(new Date());
}

/**
 * Historique prévu vs réalisé d'un jour (Module 5.12 lot E). Compare
 * l'instantané figé à la validation (lot D) à l'état courant des courses :
 * ajoutées, annulées, réassignées, retards. Server Component (lecture pure).
 * Choix du jour par formulaire GET (aucun client nécessaire).
 */
export default async function PlanningHistoriquePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}): Promise<JSX.Element> {
  await requireAdminOrRegulateurPage();
  const params = await searchParams;
  const date = resolveDate(params.date);
  const historique = await getPlanningHistorique(date);

  return (
    <div className="space-y-16">
      <PageHeader
        title="Historique prévu / réalisé"
        description="Écarts entre le planning validé et son exécution réelle."
      />

      <div className="flex flex-wrap items-center justify-between gap-12">
        <Button asChild variant="outline" size="sm">
          <Link href={`/planning?date=${date}`}>
            <ChevronLeft className="mr-8 h-12 w-12" aria-hidden />
            Retour au planning
          </Link>
        </Button>
        <form method="get" className="flex items-end gap-8">
          <label className="flex flex-col gap-4">
            <span className="text-muted-foreground text-xs font-medium">Jour</span>
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="border-input bg-background focus-visible:ring-ring h-11 rounded-md border px-8 text-sm focus-visible:outline-none focus-visible:ring-2"
            />
          </label>
          <Button type="submit" variant="outline">
            Afficher
          </Button>
        </form>
      </div>

      {historique.validatedAt ? (
        <p className="text-muted-foreground text-sm">
          Planning validé le{' '}
          {new Date(historique.validatedAt).toLocaleString('fr-FR', {
            timeZone: 'Indian/Reunion',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
          .
        </p>
      ) : null}

      <HistoriqueView historique={historique} />
    </div>
  );
}
