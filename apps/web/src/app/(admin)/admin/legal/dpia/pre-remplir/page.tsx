import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { DpiaPrefillConfirm } from './_components/dpia-prefill-confirm.client';

export const metadata = { title: 'Créer une trame DPIA — TAP Admin' };

/**
 * Écran de création de la trame squelette DPIA (Phase 06.6, Wave 3).
 *
 * Garde d'idempotence : l'écran n'existe que pour une liste DPIA vide.
 */
export default async function DpiaPrefillPage() {
  await requireDirigeantPage();

  const supabase = createClient();
  const { count } = await supabase.from('dpia_record').select('id', { count: 'exact', head: true });

  if ((count ?? 0) > 0) {
    redirect('/admin/legal/dpia');
  }

  return (
    <div className="max-w-2xl space-y-24">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Créer une trame d&apos;analyse d&apos;impact (DPIA)
        </h1>
        <p className="text-muted-foreground text-sm">
          TAP propose la structure d&apos;une DPIA pour le transport de données de santé. Vous la
          complétez ensuite.
        </p>
      </header>

      <DpiaPrefillConfirm />
    </div>
  );
}
