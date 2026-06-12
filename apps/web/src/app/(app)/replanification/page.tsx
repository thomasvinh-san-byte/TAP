import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { getActiveDriversForIncident, getOpenIncidentsWithProposals } from './_lib/queries';
import { DeclareIncidentForm } from './_components/declare-incident-form.client';
import { IncidentCard } from './_components/incident-card.client';

export const metadata = { title: 'Replanification' };
export const dynamic = 'force-dynamic';

/**
 * Replanification dynamique (CdG §5.14, DEC-160) — zone régulateur. Liste les
 * incidents chauffeur ouverts (panne / indisponibilité) et propose, pour chaque
 * course restante, une réaffectation scorée (proximité Haversine + charge),
 * validable manuellement ou en lot.
 */
export default async function ReplanificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [incidents, drivers] = await Promise.all([
    getOpenIncidentsWithProposals(),
    getActiveDriversForIncident(),
  ]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-24">
      <PageHeader
        title="Replanification"
        description="Quand un chauffeur tombe en panne ou devient indisponible, réaffectez ses courses restantes aux autres chauffeurs sans tout refaire à la main."
        actions={<DeclareIncidentForm drivers={drivers} />}
      />
      {incidents.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Aucun incident en cours"
          description="Aucun chauffeur n'est signalé en panne ou indisponible. Les pannes signalées depuis l'application chauffeur et les indisponibilités déclarées ici apparaîtront pour réaffectation."
        />
      ) : (
        <div className="space-y-24">
          {incidents.map((inc) => (
            <IncidentCard key={inc.incidentId} incident={inc} />
          ))}
        </div>
      )}
    </div>
  );
}
