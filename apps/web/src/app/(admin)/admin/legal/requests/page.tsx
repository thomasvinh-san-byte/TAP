import { createClient } from '@/lib/supabase/server';
import { RequestsList } from './_components/requests-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Demandes RGPD patients' };

/**
 * Page admin patient_data_request (DPA-04, D-09).
 * Liste les demandes de droits art. 15-21 + workflow réponse.
 */
export default async function RequestsPage() {
  await requireDirigeantPage();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('patient_data_request')
    .select('id, request_type, status, requested_at, deadline_at, requester_email, response_at')
    .order('requested_at', { ascending: false });
  if (error) {
    console.error('[admin/legal/requests] Erreur Supabase:', error);
  }

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
      <PageHeader
        title="Demandes RGPD patients"
        description="Un patient veut consulter ou effacer ses données ? Suivez sa demande ici — vous devez répondre sous 30 jours. (RGPD art. 15-21)"
      />

      <RequestsList entries={entries} />
    </div>
  );
}
