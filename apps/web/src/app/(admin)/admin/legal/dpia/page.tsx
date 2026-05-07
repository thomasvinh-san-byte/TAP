import { createClient } from '@/lib/supabase/server';
import { DpiaList } from './_components/dpia-list.client';

export const metadata = { title: 'Analyse d\'impact DPIA — TAP Admin' };

/**
 * Page admin DPIA (DPA-03, D-07).
 * Liste les analyses d'impact par status (brouillon / validée / archivée).
 */
export default async function DpiaPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from('dpia_record')
    .select(
      'id, title, status, residual_risk_level, reviewed_at, next_review_at',
    )
    .order('reviewed_at', { ascending: false });

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
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Analyses d&apos;impact (DPIA)
        </h1>
        <p className="text-sm text-muted-foreground mt-4">
          Article 35 RGPD — obligatoire pour traitement à risque élevé (santé)
        </p>
      </header>

      <DpiaList entries={entries} />
    </div>
  );
}
