import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { REGISTRE_PREFILL_ENTRIES } from '../_lib/registre-prefill-content';
import { RegistrePrefillReview } from './_components/registre-prefill-review.client';

export const metadata = { title: 'Pré-remplir le registre — TAP Admin' };

/**
 * Écran de revue du pré-remplissage du registre (Phase 06.6, Wave 2).
 *
 * Garde d'idempotence (D-09) : l'écran n'existe que pour un registre vide.
 * Si le registre contient déjà des entrées, on redirige vers la liste — le
 * pré-remplissage ne s'opère qu'une fois.
 */
export default async function RegistrePrefillPage() {
  await requireDirigeantPage();

  const supabase = createClient();
  const { count } = await supabase
    .from('data_processing_register')
    .select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    redirect('/admin/legal/registre');
  }

  return (
    <div className="space-y-24">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Pré-remplir le registre des traitements
        </h1>
        <p className="text-muted-foreground text-sm">
          Relisez et adaptez chaque entrée. Seules les entrées cochées seront ajoutées au registre.
        </p>
      </header>

      <RegistrePrefillReview entries={REGISTRE_PREFILL_ENTRIES} />
    </div>
  );
}
