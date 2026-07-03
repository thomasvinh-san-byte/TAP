import { redirect } from 'next/navigation';
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

  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);

  const { data: ridesData, error: ridesError } = await supabase
    .from('rides')
    .select('id, scheduled_at, pickup_address, dropoff_address')
    .gte('scheduled_at', `${date}T00:00:00`)
    .lte('scheduled_at', `${date}T23:59:59`)
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
