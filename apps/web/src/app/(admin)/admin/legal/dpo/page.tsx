import { createClient } from '@/lib/supabase/server';
import { DpoForm } from './dpo-form.client';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Contact DPO' };

/**
 * Page admin contact DPO (DPA-06, D-15).
 * Édition des champs `organizations.dpo_*` — un enregistrement par société.
 * Réservé au rôle dirigeant (layout (admin) garde + RLS DB).
 */
export default async function DpoPage() {
  await requireDirigeantPage();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return null;

  const orgRes = await supabase
    .from('organizations')
    .select('dpo_contact_email, dpo_contact_phone, dpo_contact_address, dpo_external')
    .eq('id', profile.organization_id)
    .single();
  const org = orgRes.data as {
    dpo_contact_email: string | null;
    dpo_contact_phone: string | null;
    dpo_contact_address: string | null;
    dpo_external: boolean | null;
  } | null;

  return (
    <div className="max-w-2xl space-y-24">
      <PageHeader
        title="Contact DPO"
        description="La personne à contacter pour les questions de données ; ses coordonnées s'affichent pour vos patients sur le site public. (RGPD art. 37-39)"
      />

      <DpoForm
        initial={{
          dpo_contact_email: org?.dpo_contact_email ?? '',
          dpo_contact_phone: org?.dpo_contact_phone ?? '',
          dpo_contact_address: org?.dpo_contact_address ?? '',
          dpo_external: org?.dpo_external ?? false,
        }}
      />
    </div>
  );
}
