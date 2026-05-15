'use server';

/**
 * Server Actions POI métier — Phase 04.5 Wave C.2 (PLAN-3 T3.2).
 *
 * Liste les POI actifs de l'organisation courante pour alimenter le
 * composant client AddressOrPOIPicker (search + sélection). RLS Postgres
 * applique le scope same-org automatiquement (policy
 * pois_metier_select_same_org).
 *
 * Pattern : import dynamique de l'helper Supabase pour éviter toute
 * contamination next/headers dans le bundle client (cf. courses/actions/
 * list.ts).
 */

export interface PoiMetierMin {
  id: string;
  nom_court: string;
  nom_long: string | null;
  type_poi: string;
  adresse: string;
  code_postal: string;
  ville: string;
  notes_acces: string | null;
}

interface PoiMetierRow {
  id: string;
  nom_court: string;
  nom_long: string | null;
  type_poi: string;
  adresse: string;
  code_postal: string;
  ville: string;
  notes_acces: string | null;
  actif: boolean;
}

export async function listPoisMetierAction(): Promise<PoiMetierMin[]> {
  const { createClient } = await import('@/lib/supabase/server');
  const supabase = createClient();
  const res = await supabase
    .from('pois_metier' as never)
    .select(
      'id, nom_court, nom_long, type_poi, adresse, code_postal, ville, notes_acces, actif',
    )
    .eq('actif', true)
    .order('nom_court', { ascending: true })
    .limit(200);

  if (res.error) {
    // Cas attendu si la migration pois_metier n'est pas encore appliquée :
    // le picker bascule en mode BAN-only sans erreur bloquante.
    return [];
  }
  const rows = (res.data ?? []) as PoiMetierRow[];
  return rows.map((r) => ({
    id: r.id,
    nom_court: r.nom_court,
    nom_long: r.nom_long,
    type_poi: r.type_poi,
    adresse: r.adresse,
    code_postal: r.code_postal,
    ville: r.ville,
    notes_acces: r.notes_acces,
  }));
}
