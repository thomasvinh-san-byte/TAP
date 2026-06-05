import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import { DpiaPrefillConfirm } from './_components/dpia-prefill-confirm.client';

export const metadata = { title: 'Créer une trame DPIA' };

/**
 * Écran de création de la trame squelette DPIA (Phase 06.6, Wave 3).
 *
 * Garde d'idempotence : l'écran n'existe que pour une liste DPIA vide.
 */
export default async function DpiaPrefillPage() {
  await requireDirigeantPage();

  const supabase = await createClient();
  const { count } = await supabase.from('dpia_record').select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    redirect('/admin/legal/dpia');
  }

  return (
    <div className="max-w-2xl space-y-24">
      <PageHeader
        title="Créer une trame d'analyse d'impact (DPIA)"
        description="TAP propose la structure d'une DPIA pour le transport de données de santé. Vous la complétez ensuite."
      />

      <DpiaPrefillConfirm />
    </div>
  );
}
