import { createClient } from '@/lib/supabase/server';
import { DriversList } from './_components/drivers-list.client';

export const metadata = { title: 'Chauffeurs — Admin TAP' };
export const dynamic = 'force-dynamic';

/**
 * Page admin chauffeurs (clôture-bis Passe 1) — RSC pré-fetch.
 *
 * Pattern miroir `/patients` : header sobre + composant client liste qui
 * monte un Sheet en mode création/édition. RLS Postgres garantit le
 * filtrage `organization_id` côté DB ; le guard rôle dirigeant est appliqué
 * dans `(admin)/layout.tsx`.
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

  return (
    <div className="space-y-24">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Chauffeurs</h1>
        <p className="text-sm text-muted-foreground">
          Référentiel des chauffeurs de l&apos;organisation. Le rattachement
          d&apos;un compte de connexion se fera lors de l&apos;invitation
          (Passe 2).
        </p>
      </header>
      <DriversList initialDrivers={(drivers ?? []) as DriverRow[]} />
    </div>
  );
}

export type DriverRow = {
  id: string;
  nom_affichage: string;
  telephone: string | null;
  numero_licence: string | null;
  type_permis: string[];
  actif: boolean;
  profile_id: string | null;
  created_at: string;
};
