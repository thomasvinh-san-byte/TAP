import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { listActiveOrderingPartiesAction } from '../actions';
import { DemandeGroupeeForm } from './_components/demande-groupee-form.client';
import { PendingGroupsList } from './_components/pending-groups-list.client';

export const metadata = { title: 'Demandes groupées' };
export const dynamic = 'force-dynamic';

export type PendingGroupRow = {
  id: string;
  created_at: string;
  ordering_party_label: string;
  ride_count: number;
};

/**
 * Demandes groupées B2B (CdC §5.5 l.191-193, DEC-158) — création + file
 * d'acceptation/refus par la régulation. Zone régulateur (`(app)`).
 */
export default async function DemandesGroupeesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const donneurs = await listActiveOrderingPartiesAction();

  // Demandes en attente (RLS scope org) + nom donneur + nombre de courses.
  const groupsRes = await supabase
    .from('ride_groups' as never)
    .select('id, created_at, ordering_party_id')
    .eq('status', 'en_attente')
    .order('created_at', { ascending: false });
  const groups =
    (groupsRes.data as { id: string; created_at: string; ordering_party_id: string }[] | null) ??
    [];

  const partyLabel = new Map(donneurs.map((d) => [d.id, d.raison_sociale]));
  const groupIds = groups.map((g) => g.id);

  const countByGroup = new Map<string, number>();
  if (groupIds.length > 0) {
    const ridesRes = await supabase
      .from('rides')
      .select('ride_group_id')
      .in('ride_group_id', groupIds);
    for (const r of (ridesRes.data as { ride_group_id: string | null }[] | null) ?? []) {
      if (r.ride_group_id) {
        countByGroup.set(r.ride_group_id, (countByGroup.get(r.ride_group_id) ?? 0) + 1);
      }
    }
  }

  const pending: PendingGroupRow[] = groups.map((g) => ({
    id: g.id,
    created_at: g.created_at,
    ordering_party_label: partyLabel.get(g.ordering_party_id) ?? 'Donneur d’ordres',
    ride_count: countByGroup.get(g.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-[1000px] space-y-24">
      <PageHeader
        title="Demandes groupées"
        description="Un donneur d'ordres commande plusieurs transports en lot. La régulation accepte ou refuse la demande ; à l'acceptation, les courses deviennent fermes."
        actions={<DemandeGroupeeForm donneurs={donneurs} />}
      />
      <PendingGroupsList pending={pending} />
    </div>
  );
}
