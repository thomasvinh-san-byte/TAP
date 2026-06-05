import { createClient } from '@/lib/supabase/server';
import { DpiaList } from './_components/dpia-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: "Analyse d'impact DPIA — TAP Admin" };

/**
 * Page admin DPIA (DPA-03, D-07).
 * Liste les analyses d'impact par status (brouillon / validée / archivée).
 */
export default async function DpiaPage() {
  await requireDirigeantPage();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('dpia_record')
    .select('id, title, status, residual_risk_level, reviewed_at, next_review_at')
    .order('reviewed_at', { ascending: false });
  if (error) {
    console.error('[admin/legal/dpia] Erreur Supabase:', error);
  }

  const entries = (data ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    residual_risk_level: string | null;
    reviewed_at: string;
    next_review_at: string;
  }>;

  return (
    <div className="space-y-24">
      <PageHeader
        title="Analyses d'impact (DPIA)"
        description="Vous manipulez des données de santé sensibles : cette analyse montre que vous avez identifié les risques et comment vous les limitez. (RGPD art. 35)"
      />

      <DpiaList entries={entries} />
    </div>
  );
}
