import Link from 'next/link';
import { ArrowLeft, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { listMyPastTournees, type PastTourneeDay } from './_lib/queries';

export const metadata = { title: 'Historique des tournées' };
export const dynamic = 'force-dynamic';

/**
 * Historique des tournées passées du chauffeur (PWA-04, §5.16).
 *
 * Écran de consultation en lecture seule : une carte par journée passée
 * (chronologique inverse), résumant le nombre de courses et leur issue.
 * Données dérivées de `rides` (pas de table tournée) et isolées par chauffeur
 * (RLS + filtre applicatif dans la query). Sobre — pas de statistiques.
 */

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC', // la date est déjà locale Réunion (AAAA-MM-JJ)
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatDay(date: string): string {
  return dayFmt.format(new Date(`${date}T00:00:00Z`));
}

export default async function HistoriquePage() {
  const jours = await listMyPastTournees();

  return (
    <div className="space-y-24">
      <Link
        href="/conduite"
        className={cn(
          'text-muted-foreground inline-flex items-center gap-8 text-sm',
          'hover:text-foreground transition-colors duration-150',
          'focus-visible:ring-ring w-fit rounded-sm focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        <ArrowLeft className="h-16 w-16" aria-hidden />
        Ma journée
      </Link>

      <PageHeader
        title="Historique des tournées"
        actions={
          jours.length > 0 ? (
            <span className="text-muted-foreground text-sm tabular-nums">
              {jours.length} journée{jours.length > 1 ? 's' : ''}
            </span>
          ) : undefined
        }
      />

      {jours.length === 0 ? (
        <div className="flex flex-col items-center gap-12 py-48 text-center">
          <CalendarClock
            className="text-muted-foreground h-48 w-48"
            aria-hidden
            strokeWidth={1.5}
          />
          <p className="text-muted-foreground max-w-[320px] text-base">
            Aucune tournée passée. Vos journées terminées apparaîtront ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-12" aria-label="Journées passées">
          {jours.map((jour) => (
            <li key={jour.date}>
              <TourneeDayCard jour={jour} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TourneeDayCard({ jour }: { jour: PastTourneeDay }): JSX.Element {
  return (
    <div className="border-border bg-background rounded-lg border px-16 py-12 shadow-sm">
      <div className="flex items-center justify-between gap-12">
        <div className="text-base font-semibold capitalize">{formatDay(jour.date)}</div>
        <div className="text-muted-foreground text-sm tabular-nums">
          {jour.total} course{jour.total > 1 ? 's' : ''}
        </div>
      </div>
      <div className="text-muted-foreground mt-4 flex gap-16 text-xs tabular-nums">
        <span>
          {jour.terminees} terminée{jour.terminees > 1 ? 's' : ''}
        </span>
        {jour.annulees > 0 && (
          <span>
            {jour.annulees} annulée{jour.annulees > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
