import { redirect } from 'next/navigation';
import { reunionDayBoundsUtc, reunionDayKey } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { OptimizationShell } from './_components/optimization-shell.client';

export const metadata = { title: 'Optimisation' };
export const dynamic = 'force-dynamic';

export default async function OptimisationPage(props: {
  searchParams: Promise<{ date?: string }>;
}): Promise<JSX.Element> {
  const searchParams = await props.searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Défaut = jour civil réunionnais (UTC+4), pas le jour UTC. Bornes du jour
  // sélectionné via le helper partagé (#497), comme le cockpit et le planning.
  const date = searchParams.date ?? reunionDayKey(new Date().toISOString());
  const { gte, lt } = reunionDayBoundsUtc(date);

  const { data: ridesData, error: ridesError } = await supabase
    .from('rides')
    .select('id, scheduled_at, pickup_address, dropoff_address')
    .gte('scheduled_at', gte)
    .lt('scheduled_at', lt)
    .order('scheduled_at');

  if (ridesError) {
    console.error('[cockpit/optimisation] Erreur Supabase:', ridesError);
  }

  // Retour typé par inférence (SELECT sans embed, non dégradé) — pas de cast.
  const rides = ridesData ?? [];

  return (
    <main className="container mx-auto max-w-screen-xl px-32 py-24">
      <OptimizationShell initialRides={rides} date={date} />
    </main>
  );
}
