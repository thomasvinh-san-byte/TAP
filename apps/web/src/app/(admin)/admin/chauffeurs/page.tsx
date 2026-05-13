import { createClient } from '@/lib/supabase/server';
import { DriversList } from './_components/drivers-list.client';

export const metadata = { title: 'Chauffeurs — Admin TAP' };
export const dynamic = 'force-dynamic';

/**
 * Page admin chauffeurs (Passe 2 — Phase 04) — RSC pré-fetch.
 *
 * Pattern miroir `/patients` : header sobre + composant client liste qui
 * monte un Sheet en mode création/édition. RLS Postgres garantit le
 * filtrage `organization_id` côté DB ; le guard rôle dirigeant est appliqué
 * dans `(admin)/layout.tsx`.
 *
 * PLAN-4 §4.7 : récupère également la dernière invitation pending par
 * driver pour afficher le badge statut compte (4 états Q1.7).
 */
export default async function ChauffeursPage() {
  const supabase = createClient();
  const { data: drivers } = await supabase
    .from('drivers' as never)
    .select(
      'id, nom_affichage, telephone, numero_licence, type_permis, actif, profile_id, created_at',
    )
    .eq('archive', false)
    .order('nom_affichage', { ascending: true });

  // Récupère la dernière invitation pending par driver (PLAN-4 §4.7).
  // RLS `driver_invitations_select_invited_or_recipient` autorise le dirigeant
  // à voir les invitations qu'il a posées.
  const { data: invitations } = await supabase
    .from('driver_invitations' as never)
    .select('id, driver_id, email, status, expires_at, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const invitationByDriverId = new Map<string, DriverInvitationRow>();
  for (const inv of (invitations ?? []) as DriverInvitationRow[]) {
    if (!invitationByDriverId.has(inv.driver_id)) {
      invitationByDriverId.set(inv.driver_id, inv);
    }
  }

  const driversWithInvitation: DriverRow[] = (
    (drivers ?? []) as Omit<DriverRow, 'invitation'>[]
  ).map((d) => ({
    ...d,
    invitation: invitationByDriverId.get(d.id) ?? null,
  }));

  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chauffeurs</h1>
        <p className="text-sm text-muted-foreground">
          Référentiel des chauffeurs de l&apos;organisation. Inviter le
          chauffeur pour lui ouvrir l&apos;accès à l&apos;application.
        </p>
      </header>
      <DriversList initialDrivers={driversWithInvitation} />
    </div>
  );
}

export type DriverInvitationRow = {
  id: string;
  driver_id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type DriverRow = {
  id: string;
  nom_affichage: string;
  telephone: string | null;
  numero_licence: string | null;
  type_permis: string[];
  actif: boolean;
  profile_id: string | null;
  created_at: string;
  invitation: DriverInvitationRow | null;
};
