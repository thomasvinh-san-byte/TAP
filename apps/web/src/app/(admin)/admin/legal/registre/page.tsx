import { Plus } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { ExportPdfButton } from './_components/export-pdf-button.client';
import { RegistreList } from './_components/registre-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';

export const metadata = { title: 'Registre des traitements — TAP Admin' };

/**
 * Page admin Registre des traitements (DPA-01, D-05, D-16).
 *
 * Pas de policy UPDATE en DB (D-05) : versioning par lignes — chaque
 * édition crée une nouvelle entrée. Le tableau présente toutes les
 * versions historiques avec la plus récente en tête.
 */
export default async function RegistrePage() {
  await requireDirigeantPage();
  const supabase = createClient();
  const { data } = await supabase
    .from('data_processing_register')
    .select('id, purpose, legal_basis, retention_period_days, international_transfer, created_at')
    .order('created_at', { ascending: false });

  const entries = (data ?? []) as Array<{
    id: string;
    purpose: string;
    legal_basis: string;
    retention_period_days: number;
    international_transfer: boolean;
    created_at: string;
  }>;

  return (
    <div className="space-y-24">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Registre des traitements</h1>
          <p className="text-muted-foreground mt-4 text-sm">
            Article 30 RGPD : versioning par lignes
          </p>
        </div>
        <div className="flex gap-12">
          <ExportPdfButton />
          <Button asChild>
            <Link href="#nouveau">
              <Plus className="mr-8 h-16 w-16" aria-hidden />
              Nouvelle entrée
            </Link>
          </Button>
        </div>
      </header>

      <RegistreList entries={entries} />
    </div>
  );
}
