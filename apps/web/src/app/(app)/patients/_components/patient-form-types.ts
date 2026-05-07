/**
 * Defaults du formulaire patient — type partagé entre le composant
 * principal et les sous-sections (Identité / Coordonnées / Préférences).
 */
export interface PatientFormDefaults {
  prenom?: string;
  nom?: string;
  date_naissance?: string;
  genre?: 'M' | 'F' | 'X';
  nir?: string;
  telephone?: string;
  adresse_ligne1?: string;
  adresse_ligne2?: string;
  code_postal?: string;
  ville?: string;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  canal_contact_prefere?: 'sms' | 'appel' | 'aucun';
  consentement_sms?: boolean;
  notes_operationnelles?: string;
}
