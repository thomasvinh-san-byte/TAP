import { CloudLightning } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { getActiveWeatherAlert } from './_lib/queries';
import { WeatherAlertControl } from './_components/weather-alert-control.client';
import { WeatherCancelForm } from './_components/weather-cancel-form.client';

export const metadata = { title: 'Alerte météo' };
export const dynamic = 'force-dynamic';

/**
 * Mode alerte météo / cyclone (DEC-170, CdG l.380-385) — zone régulateur. En
 * alerte cyclone, l'activité est suspendue : la régulatrice bascule l'org en
 * mode météo puis annule en masse les courses du jour (statut `annulee_meteo`),
 * avec notification SMS patients et push chauffeurs (best-effort).
 */
export default async function MeteoPage(): Promise<JSX.Element> {
  await requireAdminOrRegulateurPage();
  const active = await getActiveWeatherAlert();

  return (
    <div className="mx-auto max-w-[760px] space-y-24">
      <PageHeader
        title="Alerte météo"
        description="En cas d'alerte cyclone, basculez toute l'activité en mode météo et annulez en masse les courses de la journée. Les patients consentants et les chauffeurs concernés sont prévenus automatiquement."
      />
      <section className="space-y-12">
        <div className="flex items-center gap-8">
          <CloudLightning className="text-muted-foreground h-16 w-16" aria-hidden />
          <h2 className="text-base font-semibold">État du mode météo</h2>
        </div>
        <WeatherAlertControl active={active} />
      </section>
      <section className="space-y-12">
        <h2 className="text-base font-semibold">Annulation en masse</h2>
        <WeatherCancelForm enabled={active !== null} />
      </section>
    </div>
  );
}
