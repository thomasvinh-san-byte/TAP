import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { requireAdminOrRegulateurPage } from '@/lib/auth/require-admin-or-regulateur-page';
import { isMessagingEnabled } from '@/lib/release-flags';
import { GeneralChat } from '@/components/messaging/general-chat.client';

export const metadata = { title: 'Fil général' };
export const dynamic = 'force-dynamic';

/**
 * Fil général de messagerie interne hors course (§5.22 lot A) — zone régulateur.
 * Discussion commune régulateur ↔ chauffeurs de l'organisation, temps réel,
 * org-scoped, archivée 1 an. Même release toggle que le point d'accès du header
 * (`isMessagingEnabled`) : LIVRÉE → ON par défaut, route masquée (404) seulement
 * si le kill-switch `MESSAGING_ENABLED=false` est posé.
 */
export default async function MessageriePage(): Promise<JSX.Element> {
  if (!isMessagingEnabled()) notFound();
  await requireAdminOrRegulateurPage();
  const ctx = await getAuthContext();
  if (!ctx) notFound();

  return (
    <div className="mx-auto max-w-[760px] space-y-24">
      <PageHeader
        title="Fil général"
        description="Discussion commune de l'organisation, hors course. Pour échanger sur une course précise, ouvrez son chat depuis la course."
      />
      <GeneralChat organizationId={ctx.organizationId} />
    </div>
  );
}
