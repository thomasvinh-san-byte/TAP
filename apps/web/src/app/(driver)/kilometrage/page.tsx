import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { cn } from '@/lib/utils';
import { getTodayMileage } from './_lib/queries';
import { MileageForm } from './_components/mileage-form.client';

export const metadata = { title: 'Kilométrage' };
export const dynamic = 'force-dynamic';

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'UTC', // `jour` est déjà une date locale Réunion (AAAA-MM-JJ)
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Écran de saisie du relevé kilométrique du jour (PWA-04, §5.16).
 *
 * RSC : charge le relevé du jour (RLS `driver_id = auth.uid()`), le formulaire
 * client gère la saisie en ligne / hors-ligne (file de mutations).
 */
export default async function KilometragePage() {
  const { jour, km_start, km_end } = await getTodayMileage();

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
        title="Kilométrage"
        description={`Relevé du compteur — ${dayFmt.format(new Date(`${jour}T00:00:00Z`))}.`}
      />

      <MileageForm jour={jour} kmStart={km_start} kmEnd={km_end} />
    </div>
  );
}
