import { createClient } from '@/lib/supabase/server';
import { RequestsList } from './_components/requests-list.client';

export const metadata = { title: 'Demandes RGPD patients — TAP Admin' };

/**
 * Page admin patient_data_request (DPA-04, D-09).
 * Liste les demandes de droits art. 15-21 + workflow réponse.
 */
export default async function RequestsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('patient_data_request')
    .select(
      'id, request_type, status, requested_at, deadline_at, requester_email, response_at',
    )
    .order('requested_at', { ascending: false });

  const entries = (data ?? []) as Array<{
    id: string;
    request_type: string;
    status: string;
    requested_at: string;
    deadline_at: string;
    requester_email: string | null;
    response_at: string | null;
  }>;

  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Demandes RGPD patients
        </h1>
        <p className="text-sm text-muted-foreground mt-4">
          Articles 15-21 RGPD — délai légal 30 jours
        </p>
      </header>

      <RequestsList entries={entries} />
    </div>
  );
}
