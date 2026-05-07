// =============================================================================
// types.gen.ts — Types Supabase générés depuis le schéma local
// =============================================================================
// Ce fichier reproduit le format émis par `supabase gen types typescript
// --local` pour les tables de la migration 003. Régénération impossible
// dans la sandbox CI (Docker registry public.ecr.aws bloqué — voir le
// SUMMARY 01-2). En production, exécuter `pnpm db:types` après chaque
// migration appliquée pour réécrire ce fichier depuis le schéma réel.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          nom: string;
          siret: string | null;
          adresse: string | null;
          code_postal: string | null;
          ville: string | null;
          telephone: string | null;
          email: string | null;
          numero_agrement_cgss: string | null;
          date_creation: string;
          date_archivage: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nom: string;
          siret?: string | null;
          adresse?: string | null;
          code_postal?: string | null;
          ville?: string | null;
          telephone?: string | null;
          email?: string | null;
          numero_agrement_cgss?: string | null;
          date_creation?: string;
          date_archivage?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nom?: string;
          siret?: string | null;
          adresse?: string | null;
          code_postal?: string | null;
          ville?: string | null;
          telephone?: string | null;
          email?: string | null;
          numero_agrement_cgss?: string | null;
          date_creation?: string;
          date_archivage?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          role: Database['public']['Enums']['user_role'];
          prenom: string;
          nom: string;
          telephone: string | null;
          email: string;
          actif: boolean;
          date_archivage: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          role: Database['public']['Enums']['user_role'];
          prenom: string;
          nom: string;
          telephone?: string | null;
          email: string;
          actif?: boolean;
          date_archivage?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          role?: Database['public']['Enums']['user_role'];
          prenom?: string;
          nom?: string;
          telephone?: string | null;
          email?: string;
          actif?: boolean;
          date_archivage?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          id: string;
          organization_id: string;
          actor_id: string | null;
          actor_role: Database['public']['Enums']['user_role'] | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          actor_id?: string | null;
          actor_role?: Database['public']['Enums']['user_role'] | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          organization_id: string;
          prenom: string;
          nom: string;
          date_naissance: string;
          genre: string | null;
          telephone: string | null;
          telephone_normalized: string | null;
          adresse_ligne1: string;
          adresse_ligne2: string | null;
          code_postal: string;
          ville: string;
          contact_urgence_nom: string | null;
          contact_urgence_telephone: string | null;
          nir_encrypted: string | null;
          nir_search_hash: string | null;
          nir_last4: string | null;
          canal_contact_prefere: Database['public']['Enums']['canal_contact_prefere'];
          consentement_sms: boolean;
          consentement_sms_at: string | null;
          archive: boolean;
          archive_at: string | null;
          archive_reason: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
          search_text: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          prenom: string;
          nom: string;
          date_naissance: string;
          genre?: string | null;
          telephone?: string | null;
          telephone_normalized?: string | null;
          adresse_ligne1: string;
          adresse_ligne2?: string | null;
          code_postal: string;
          ville: string;
          contact_urgence_nom?: string | null;
          contact_urgence_telephone?: string | null;
          nir_encrypted?: string | null;
          nir_search_hash?: string | null;
          nir_last4?: string | null;
          canal_contact_prefere?: Database['public']['Enums']['canal_contact_prefere'];
          consentement_sms?: boolean;
          consentement_sms_at?: string | null;
          archive?: boolean;
          archive_at?: string | null;
          archive_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          prenom?: string;
          nom?: string;
          date_naissance?: string;
          genre?: string | null;
          telephone?: string | null;
          telephone_normalized?: string | null;
          adresse_ligne1?: string;
          adresse_ligne2?: string | null;
          code_postal?: string;
          ville?: string;
          contact_urgence_nom?: string | null;
          contact_urgence_telephone?: string | null;
          nir_encrypted?: string | null;
          nir_search_hash?: string | null;
          nir_last4?: string | null;
          canal_contact_prefere?: Database['public']['Enums']['canal_contact_prefere'];
          consentement_sms?: boolean;
          consentement_sms_at?: string | null;
          archive?: boolean;
          archive_at?: string | null;
          archive_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'patients_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      patient_constraint: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string;
          type: Database['public']['Enums']['patient_constraint_type'];
          note: string | null;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          type: Database['public']['Enums']['patient_constraint_type'];
          note?: string | null;
          created_at?: string;
          created_by: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          type?: Database['public']['Enums']['patient_constraint_type'];
          note?: string | null;
          created_at?: string;
          created_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_constraint_patient_id_fkey';
            columns: ['patient_id'];
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
        ];
      };
      patient_operational_note: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string;
          content: string;
          author_id: string;
          replaced_by_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id: string;
          content: string;
          author_id: string;
          replaced_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string;
          content?: string;
          author_id?: string;
          replaced_by_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_operational_note_patient_id_fkey';
            columns: ['patient_id'];
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      patients_safe: {
        Row: {
          id: string | null;
          organization_id: string | null;
          nom: string | null;
          prenom: string | null;
          date_naissance: string | null;
          genre: string | null;
          telephone: string | null;
          telephone_normalized: string | null;
          adresse_ligne1: string | null;
          adresse_ligne2: string | null;
          code_postal: string | null;
          ville: string | null;
          canal_contact_prefere: Database['public']['Enums']['canal_contact_prefere'] | null;
          consentement_sms: boolean | null;
          consentement_sms_at: string | null;
          contact_urgence_nom: string | null;
          contact_urgence_telephone: string | null;
          nir_last4: string | null;
          has_nir: boolean | null;
          archive: boolean | null;
          archive_at: string | null;
          archive_reason: string | null;
          search_text: string | null;
          created_at: string | null;
          updated_at: string | null;
          created_by: string | null;
          updated_by: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_organization_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['user_role'];
      };
      has_role: {
        Args: { required_role: Database['public']['Enums']['user_role'] };
        Returns: boolean;
      };
      search_patients: {
        Args: { q: string };
        Returns: Database['public']['Views']['patients_safe']['Row'][];
      };
      unaccent_immutable: {
        Args: { input: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: 'dirigeant' | 'regulateur' | 'chauffeur';
      patient_constraint_type:
        | 'medical_oxygene'
        | 'medical_fauteuil'
        | 'medical_brancard'
        | 'vehicule_tpmr'
        | 'horaire_matin'
        | 'horaire_apres_midi'
        | 'accompagnement_obligatoire'
        | 'autre';
      canal_contact_prefere: 'sms' | 'appel' | 'aucun';
    };
    CompositeTypes: Record<string, never>;
  };
}
