import { createClient } from '@/lib/supabase/server';
import { BreachList } from './_components/breach-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Violations de données' };

/**
 * Page admin breaches (DPA-05, D-08).
 * Liste les incidents avec compteur 72h en temps réel pour ceux qui requièrent
 * notification CNIL non encore envoyée.
 */
export default async function BreachesPage() {
  await requireDirigeantPage();
  const supabase = createClient();
  const { data, error } = await supabase
    .from('data_breach_incident')
    .select(
      'id, detected_at, severity, nature, description, cnil_notification_required, cnil_notification_at, closed_at',
    )
    .order('detected_at', { ascending: false });
  if (error) {
    console.error('[admin/legal/breaches] Erreur Supabase:', error);
  }

  const entries = (data ?? []) as Array<{
    id: string;
    detected_at: string;
    severity: string;
    nature: string;
    description: string;
    cnil_notification_required: boolean;
    cnil_notification_at: string | null;
    closed_at: string | null;
  }>;

  return (
    <div className="space-y-24">
      <PageHeader
        title="Violations de données"
        description="Une donnée patient a fuité ou été perdue ? Déclarez-le ici : vous avez 72 h pour prévenir la CNIL. (RGPD art. 33)"
      />

      <BreachList entries={entries} />
    </div>
  );
}
