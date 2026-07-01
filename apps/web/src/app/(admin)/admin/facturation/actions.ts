'use server';

/**
 * Server Actions de la facturation — volet comptable FEC (EXPORT-01, §5.23).
 *
 * Deux actions, réservées au dirigeant (`requireDirigeant`, DEC-040) :
 *   - `updateOrganizationSiretAction` : renseigne le SIRET de la société,
 *     prérequis au nommage réglementaire du FEC (le SIREN en est les 9
 *     premiers chiffres).
 *   - `exportFecAction` : génère le fichier FEC des ventes encaissées d'un mois
 *     (délégué au util pur `@tap/shared` generateFec — 18 champs, pipe, dates
 *     AAAAMMJJ, montants à virgule, écritures équilibrées).
 *
 * Périmètre comptable ASSUMÉ (Étape 0) : FEC des VENTES ENCAISSÉES connues de
 * TAP, pas la comptabilité exhaustive de l'entreprise. Plan de comptes = valeurs
 * par défaut PCG (`DEFAULT_FEC_ACCOUNTS`), paramétrable au niveau code, à
 * confirmer par le comptable. Pas de donnée médicale dans le fichier.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { generateFec } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { getOrganizationSiret, listEncaissementsForFec } from './_lib/queries-fec';

export type SiretActionState = { error?: string; success?: boolean };

const siretSchema = z.object({
  siret: z.string().regex(/^\d{14}$/, 'SIRET invalide : 14 chiffres attendus.'),
});

export async function updateOrganizationSiretAction(
  input: z.infer<typeof siretSchema>,
): Promise<SiretActionState> {
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = siretSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return { error: 'Profil introuvable.' };

  // DEC-041 — vérification du nombre de lignes affectées (RLS dirigeant only).
  const upd = await supabase
    .from('organizations')
    .update({ siret: parsed.data.siret } as never)
    .eq('id', profile.organization_id)
    .select('id');

  if (upd.error) return { error: 'Enregistrement du SIRET impossible.' };
  if (!upd.data || (upd.data as unknown[]).length === 0) {
    return { error: 'Modification refusée : droits insuffisants.' };
  }

  revalidatePath('/admin/facturation');
  return { success: true };
}

const fecSchema = z.object({
  mois: z.string().regex(/^\d{4}-\d{2}$/, 'Mois invalide (AAAA-MM attendu).'),
});

export interface ExportFecResult {
  content?: string;
  filename?: string;
  entryCount?: number;
  error?: string;
}

/** Bornes UTC d'un mois `AAAA-MM` : premier jour, dernier jour. */
function monthBounds(mois: string): { from: string; to: string; clotureIso: string } {
  const [yStr, mStr] = mois.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0)); // jour 0 du mois suivant = dernier jour
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(first), to: iso(last), clotureIso: last.toISOString() };
}

export async function exportFecAction(input: z.infer<typeof fecSchema>): Promise<ExportFecResult> {
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = fecSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Filtres invalides.' };
  }

  const siret = await getOrganizationSiret();
  if (!siret || !/^\d{14}$/.test(siret)) {
    return {
      error: 'Renseignez d’abord le SIRET de la société (14 chiffres) pour générer le FEC.',
    };
  }
  const siren = siret.slice(0, 9);

  const { from, to, clotureIso } = monthBounds(parsed.data.mois);
  const encaissements = await listEncaissementsForFec(from, to);

  try {
    const fec = generateFec({ siren, clotureDate: clotureIso, encaissements });
    return { content: fec.content, filename: fec.filename, entryCount: fec.entryCount };
  } catch {
    return { error: 'Génération du FEC impossible.' };
  }
}
