import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { DPA_PREFILL_FICHES } from '../_lib/dpa-prefill-content';
import { DpaPrefillReview } from './_components/dpa-prefill-review.client';

export const metadata = { title: 'Pré-remplir les fiches DPA — TAP Admin' };

/**
 * Écran de revue du pré-remplissage des fiches DPA (Phase 06.6, Wave 3).
 *
 * Garde d'idempotence : l'écran n'existe que pour une liste DPA vide.
 */
export default async function DpaPrefillPage() {
  await requireDirigeantPage();

  const supabase = createClient();
  const { count } = await supabase.from('dpa_record').select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    redirect('/admin/legal/dpa');
  }

  return (
    <div className="space-y-24">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pré-remplir les fiches sous-traitants
        </h1>
        <p className="text-muted-foreground text-sm">
          Relisez chaque fiche et renseignez la version et la date de signature du DPA. Seules les
          fiches cochées seront ajoutées.
        </p>
      </header>

      <DpaPrefillReview fiches={DPA_PREFILL_FICHES} />
    </div>
  );
}
