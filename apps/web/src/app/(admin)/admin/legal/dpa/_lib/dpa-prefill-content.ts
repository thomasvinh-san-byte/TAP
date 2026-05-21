/**
 * Fiches-types DPA des sous-traitants techniques — Phase 06.6 (D-04).
 *
 * TAP connaît ses sous-traitants techniques et pré-remplit leur fiche
 * descriptive. Le contrat lui-même reste propre au dirigeant : `signed_at`
 * et `dpa_version` sont laissés VIDES — le dirigeant les saisit sur l'écran
 * de revue. TAP décrit la fiche, ne valide pas le contrat.
 *
 * Le fournisseur SMS n'est pas listé (différé — ADR-004).
 */

export interface DpaPrefillFiche {
  subprocessor_name: string;
  subprocessor_role: string;
  dpa_version: string;
  signed_at: string;
  notes: string;
}

export const DPA_PREFILL_FICHES: DpaPrefillFiche[] = [
  {
    subprocessor_name: 'Supabase',
    subprocessor_role: 'Hébergement de la base de données, authentification et stockage',
    dpa_version: '',
    signed_at: '',
    notes:
      'Sous-traitant technique. Joindre le DPA signé. Vérifier la localisation des données et le statut HDS (cf. Phase 06.5).',
  },
  {
    subprocessor_name: 'Vercel',
    subprocessor_role: "Hébergement de l'application web (front-end)",
    dpa_version: '',
    signed_at: '',
    notes: 'Sous-traitant technique. Joindre le DPA signé.',
  },
];
