import { createClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { DriversList } from './_components/drivers-list.client';

export const metadata = { title: 'Chauffeurs — Admin TAP' };
export const dynamic = 'force-dynamic';

/**
 * Page admin chauffeurs (Passe 2 — Phase 04, hotfix DEC-029) — RSC pré-fetch.
 *
 * Query param `vue` :
 *   - `actifs` (par défaut) : chauffeurs non archivés
 *   - `archives`            : chauffeurs archivés (réservé toggle UI)
 *
 * RLS Postgres garantit le filtrage `organization_id`. Les guards rôle
 * sont posés en `(admin)/layout.tsx` (dirigeant ou régulateur).
 */
export default async function ChauffeursPage({
  searchParams,
}: {
  searchParams?: { vue?: string };
}) {
  const supabase = createClient();
  const ctx = await getAuthContext();
  const role = ctx?.role ?? 'regulateur';

  const vueArchives = searchParams?.vue === 'archives';

  // DEBUG-CHAUFFEURS-VIDE-REGULATEUR : logging temporaire pour capturer
  // l'erreur Supabase silencieuse remontée par l'UAT preview (Vercel)
  // — la liste apparaît vide en régulateur alors que la modale
  // d'affectation /courses voit bien les 3 chauffeurs. À retirer une
  // fois la cause root identifiée et fixée.
  const driversRes = await supabase
    .from('drivers' as never)
    .select(
      'id, nom_affichage, telephone, numero_licence, type_permis, actif, archive, archive_at, archive_motif, profile_id, created_at',
    )
    .eq('archive', vueArchives)
    .order('nom_affichage', { ascending: true });

  if (driversRes.error) {
    console.error('[admin/chauffeurs] drivers query error', {
      message: driversRes.error.message,
      code: driversRes.error.code,
      details: driversRes.error.details,
      hint: driversRes.error.hint,
      user_role: role,
      user_id: ctx?.userId,
      organization_id: ctx?.organizationId,
      vue_archives: vueArchives,
    });
  }

  const drivers = driversRes.data;

  // Récupère la dernière invitation pending par driver (PLAN-4 §4.7).
  const invitationsRes = await supabase
    .from('driver_invitations' as never)
    .select('id, driver_id, email, status, expires_at, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (invitationsRes.error) {
    console.error('[admin/chauffeurs] invitations query error', {
      message: invitationsRes.error.message,
      code: invitationsRes.error.code,
      details: invitationsRes.error.details,
      hint: invitationsRes.error.hint,
    });
  }

  const invitations = invitationsRes.data;

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
          Référentiel des chauffeurs de l&apos;organisation. Invitez le
          chauffeur pour lui ouvrir l&apos;accès à l&apos;application.
        </p>
      </header>
      <DriversList
        initialDrivers={driversWithInvitation}
        currentRole={role as 'dirigeant' | 'regulateur'}
        vue={vueArchives ? 'archives' : 'actifs'}
      />
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
  archive: boolean;
  archive_at: string | null;
  archive_motif: string | null;
  profile_id: string | null;
  created_at: string;
  invitation: DriverInvitationRow | null;
};
