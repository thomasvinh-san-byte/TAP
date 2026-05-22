import { createClient } from '@/lib/supabase/server';
import { DpaList } from './_components/dpa-list.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';

export const metadata = { title: 'DPA sous-traitants' };

/**
 * Page admin DPA records (DPA-02, D-06).
 * Liste les Data Processing Agreements signés avec sous-traitants
 * (Supabase, Twilio, OVH SMS, Stripe, etc.).
 */
export default async function DpaPage() {
  await requireDirigeantPage();
  const supabase = createClient();
  const { data } = await supabase
    .from('dpa_record')
    .select('id, subprocessor_name, subprocessor_role, dpa_version, signed_at, expires_at')
    .order('signed_at', { ascending: false });

  const entries = (data ?? []) as Array<{
    id: string;
    subprocessor_name: string;
    subprocessor_role: string;
    dpa_version: string;
    signed_at: string;
    expires_at: string | null;
  }>;

  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">DPA sous-traitants</h1>
        <p className="text-muted-foreground mt-4 text-sm">
          Vos prestataires qui accèdent aux données patients doivent signer un contrat —
          conservez-les ici pour prouver que vous êtes en règle. (RGPD art. 28)
        </p>
      </header>

      <DpaList entries={entries} />
    </div>
  );
}
