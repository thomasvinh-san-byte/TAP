// =============================================================================
// types.gen.ts — Types Supabase générés depuis le schéma local
// =============================================================================
// Ce fichier reproduit le format émis par `supabase gen types typescript
// --local` pour les migrations Phase 1 + Phase 1.5. Régénération impossible
// dans la sandbox CI (Docker registry public.ecr.aws bloqué — voir SUMMARY
// 01-2). En production, exécuter `pnpm db:types` après chaque migration
// appliquée pour réécrire ce fichier depuis le schéma réel.
//
// Phase 1.5 ajoute :
//   - 5 tables RGPD : data_processing_register, dpa_record, dpia_record,
//     data_breach_incident, patient_data_request
//   - 3 tables additionnelles : cgu_acceptance, cookie_consent_log,
//     legal_request_attempts
//   - 5 colonnes DPO sur organizations + 2 colonnes CGU sur profiles
//   - patients : prenom/nom/date_naissance/adresse_ligne1/code_postal/ville
//     deviennent nullable (Rule 2 — anonymisation art. 17)
//   - 4 nouvelles fonctions RPC : check_breach_deadlines,
//     purge_legal_request_attempts, rgpd_anonymize_patient,
//     nir_match_patient_for_legal_request
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
          dpo_contact_email: string | null;
          dpo_contact_phone: string | null;
          dpo_contact_address: string | null;
          dpo_external: boolean;
          dpo_updated_at: string | null;
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
          dpo_contact_email?: string | null;
          dpo_contact_phone?: string | null;
          dpo_contact_address?: string | null;
          dpo_external?: boolean;
          dpo_updated_at?: string | null;
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
          dpo_contact_email?: string | null;
          dpo_contact_phone?: string | null;
          dpo_contact_address?: string | null;
          dpo_external?: boolean;
          dpo_updated_at?: string | null;
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
          cgu_version_accepted: string | null;
          cgu_accepted_at: string | null;
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
          cgu_version_accepted?: string | null;
          cgu_accepted_at?: string | null;
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
          cgu_version_accepted?: string | null;
          cgu_accepted_at?: string | null;
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
          prenom: string | null;
          nom: string | null;
          date_naissance: string | null;
          genre: string | null;
          telephone: string | null;
          telephone_normalized: string | null;
          adresse_ligne1: string | null;
          adresse_ligne2: string | null;
          code_postal: string | null;
          ville: string | null;
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
          prenom?: string | null;
          nom?: string | null;
          date_naissance?: string | null;
          genre?: string | null;
          telephone?: string | null;
          telephone_normalized?: string | null;
          adresse_ligne1?: string | null;
          adresse_ligne2?: string | null;
          code_postal?: string | null;
          ville?: string | null;
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
          prenom?: string | null;
          nom?: string | null;
          date_naissance?: string | null;
          genre?: string | null;
          telephone?: string | null;
          telephone_normalized?: string | null;
          adresse_ligne1?: string | null;
          adresse_ligne2?: string | null;
          code_postal?: string | null;
          ville?: string | null;
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
      data_processing_register: {
        Row: {
          id: string;
          organization_id: string;
          purpose: string;
          legal_basis: string;
          data_categories: string[];
          data_subjects: string[];
          recipients: string[];
          retention_period_days: number;
          security_measures: string;
          international_transfer: boolean;
          international_transfer_safeguards: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          purpose: string;
          legal_basis: string;
          data_categories: string[];
          data_subjects: string[];
          recipients: string[];
          retention_period_days: number;
          security_measures: string;
          international_transfer?: boolean;
          international_transfer_safeguards?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'data_processing_register_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      dpa_record: {
        Row: {
          id: string;
          organization_id: string;
          subprocessor_name: string;
          subprocessor_role: string;
          dpa_version: string;
          dpa_document_url: string | null;
          signed_at: string;
          expires_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          subprocessor_name: string;
          subprocessor_role: string;
          dpa_version: string;
          dpa_document_url?: string | null;
          signed_at: string;
          expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          subprocessor_name?: string;
          subprocessor_role?: string;
          dpa_version?: string;
          dpa_document_url?: string | null;
          signed_at?: string;
          expires_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dpa_record_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      dpia_record: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          scope: string;
          data_flow_diagram: string | null;
          risks_identified: Json;
          mitigations: Json;
          residual_risk_level: string | null;
          cnil_consultation_required: boolean;
          cnil_consultation_date: string | null;
          reviewed_at: string;
          next_review_at: string;
          status: string;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          scope: string;
          data_flow_diagram?: string | null;
          risks_identified?: Json;
          mitigations?: Json;
          residual_risk_level?: string | null;
          cnil_consultation_required?: boolean;
          cnil_consultation_date?: string | null;
          reviewed_at: string;
          next_review_at: string;
          status: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          scope?: string;
          data_flow_diagram?: string | null;
          risks_identified?: Json;
          mitigations?: Json;
          residual_risk_level?: string | null;
          cnil_consultation_required?: boolean;
          cnil_consultation_date?: string | null;
          reviewed_at?: string;
          next_review_at?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'dpia_record_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      data_breach_incident: {
        Row: {
          id: string;
          organization_id: string;
          detected_at: string;
          severity: string;
          nature: string;
          affected_data_categories: string[];
          affected_subjects_count: number | null;
          description: string;
          immediate_measures: string;
          cnil_notification_required: boolean;
          cnil_notification_at: string | null;
          cnil_notification_reference: string | null;
          subjects_notification_required: boolean;
          subjects_notified_at: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          detected_at: string;
          severity: string;
          nature: string;
          affected_data_categories: string[];
          affected_subjects_count?: number | null;
          description: string;
          immediate_measures: string;
          cnil_notification_required?: boolean;
          cnil_notification_at?: string | null;
          cnil_notification_reference?: string | null;
          subjects_notification_required?: boolean;
          subjects_notified_at?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          detected_at?: string;
          severity?: string;
          nature?: string;
          affected_data_categories?: string[];
          affected_subjects_count?: number | null;
          description?: string;
          immediate_measures?: string;
          cnil_notification_required?: boolean;
          cnil_notification_at?: string | null;
          cnil_notification_reference?: string | null;
          subjects_notification_required?: boolean;
          subjects_notified_at?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'data_breach_incident_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      patient_data_request: {
        Row: {
          id: string;
          organization_id: string;
          patient_id: string | null;
          request_type: string;
          requested_at: string;
          deadline_at: string;
          status: string;
          response: string | null;
          response_at: string | null;
          response_by: string | null;
          request_token: string;
          request_token_expires_at: string;
          requester_email: string | null;
          requester_proof_of_identity_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          patient_id?: string | null;
          request_type: string;
          requested_at?: string;
          deadline_at?: string;
          status: string;
          response?: string | null;
          response_at?: string | null;
          response_by?: string | null;
          request_token: string;
          request_token_expires_at: string;
          requester_email?: string | null;
          requester_proof_of_identity_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          patient_id?: string | null;
          request_type?: string;
          requested_at?: string;
          deadline_at?: string;
          status?: string;
          response?: string | null;
          response_at?: string | null;
          response_by?: string | null;
          request_token?: string;
          request_token_expires_at?: string;
          requester_email?: string | null;
          requester_proof_of_identity_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'patient_data_request_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'patient_data_request_patient_id_fkey';
            columns: ['patient_id'];
            referencedRelation: 'patients';
            referencedColumns: ['id'];
          },
        ];
      };
      cgu_acceptance: {
        Row: {
          id: string;
          profile_id: string;
          version: string;
          document_type: string;
          accepted_at: string;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          version: string;
          document_type: string;
          accepted_at?: string;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'cgu_acceptance_profile_id_fkey';
            columns: ['profile_id'];
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      cookie_consent_log: {
        Row: {
          id: string;
          session_token_hash: string;
          choices: Json;
          user_agent_hash: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_token_hash: string;
          choices: Json;
          user_agent_hash?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      legal_request_attempts: {
        Row: {
          id: string;
          token_hash: string;
          attempted_at: string;
          success: boolean;
        };
        Insert: {
          id?: string;
          token_hash: string;
          attempted_at?: string;
          success?: boolean;
        };
        Update: never;
        Relationships: [];
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
      check_breach_deadlines: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      purge_legal_request_attempts: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      };
      rgpd_anonymize_patient: {
        Args: {
          p_patient_id: string;
          p_request_id: string;
          p_salt: string;
        };
        Returns: void;
      };
      nir_match_patient_for_legal_request: {
        Args: {
          p_request_id: string;
          p_nir_search_hash: string;
          p_nom: string;
          p_date_naissance: string;
        };
        Returns: string | null;
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
