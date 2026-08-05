'use server';

/**
 * Création RAPIDE d'un patient depuis le formulaire de course (EXPRESS volet 2).
 *
 * N'ALLÈGE PAS les règles, seulement la saisie : réutilise le MÊME schéma de
 * validation que la création normale (`patientSchema`) sur un sous-ensemble de
 * champs, insère par le même chemin, et RETOURNE l'identifiant + le domicile du
 * patient créé (au lieu de rediriger) pour permettre sa sélection automatique
 * dans la course (ce qui déclenche le pré-remplissage d'adresse du volet 1).
 *
 * GARDE-FOU NON NÉGOCIABLE — patient mineur : la création rapide REFUSE, côté
 * SERVEUR (le client n'est pas de confiance), de créer un mineur sans référent
 * légal. La création normale s'appuie sur un avertissement NON bloquant
 * (DEC-172, « le régulateur garde la main ») ; la création rapide est
 * volontairement plus stricte, comme l'exige ce lot.
 *
 * Champs réellement différables (NIR, préférences) : omis ici, complétables plus
 * tard dans la fiche patient (le NIR est déjà optionnel → aucun appel Edge
 * Function de chiffrement sur ce chemin).
 */
import { patientSchema, normalizePhone, isMinor } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export interface QuickPatientHome {
  ligne1: string | null;
  ligne2: string | null;
  code_postal: string | null;
  ville: string | null;
}

export type QuickCreatePatientResult =
  | { error: string }
  | { ok: true; id: string; label: string; home: QuickPatientHome };

export async function quickCreatePatientAction(
  formData: FormData,
): Promise<QuickCreatePatientResult> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  // MÊME schéma que la création normale (pas de validation parallèle laxiste) —
  // sous-ensemble de champs présentés ; les champs différables sont omis.
  const parsed = patientSchema.safeParse({
    prenom: raw.prenom,
    nom: raw.nom,
    date_naissance: raw.date_naissance,
    telephone: raw.telephone || undefined,
    adresse: {
      ligne1: raw.adresse_ligne1,
      ligne2: raw.adresse_ligne2 || undefined,
      code_postal: raw.code_postal,
      ville: raw.ville,
    },
    canal_contact_prefere: 'appel',
    consentement_sms: false,
    referent_nom: raw.referent_nom?.trim() || undefined,
    referent_lien: raw.referent_lien?.trim() || undefined,
    referent_telephone: raw.referent_telephone?.trim() || undefined,
    referent_type: raw.referent_type || undefined,
    archive: false,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const data = parsed.data;

  // Garde-fou mineur (serveur) : jamais de mineur sans référent par ce chemin.
  if (isMinor(data.date_naissance) && !(data.referent_nom && data.referent_type)) {
    return {
      error:
        'Patient mineur : un référent légal (nom + type d’autorité) est requis. Utilisez la fiche complète.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' };

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return { error: 'Profil introuvable.' };

  const { data: row, error } = await supabase
    .from('patients')
    .insert({
      organization_id: profile.organization_id,
      prenom: data.prenom,
      nom: data.nom,
      date_naissance: data.date_naissance,
      telephone: data.telephone ?? null,
      telephone_normalized: data.telephone ? normalizePhone(data.telephone) : null,
      adresse_ligne1: data.adresse.ligne1,
      adresse_ligne2: data.adresse.ligne2 ?? null,
      code_postal: data.adresse.code_postal,
      ville: data.adresse.ville,
      canal_contact_prefere: data.canal_contact_prefere,
      consentement_sms: false,
      referent_nom: data.referent_nom ?? null,
      referent_lien: data.referent_lien ?? null,
      referent_telephone: data.referent_telephone ?? null,
      referent_type: data.referent_type ?? null,
      archive: false,
      created_by: user.id,
    })
    .select('id, adresse_ligne1, adresse_ligne2, code_postal, ville')
    .single();

  const created = row as {
    id: string;
    adresse_ligne1: string | null;
    adresse_ligne2: string | null;
    code_postal: string | null;
    ville: string | null;
  } | null;
  if (error || !created) {
    return { error: 'Création impossible. Complétez la fiche patient complète.' };
  }

  return {
    ok: true,
    id: created.id,
    label: `${data.prenom} ${data.nom}`,
    home: {
      ligne1: created.adresse_ligne1,
      ligne2: created.adresse_ligne2,
      code_postal: created.code_postal,
      ville: created.ville,
    },
  };
}
